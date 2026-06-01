import { analyzeProof, scoreArtifact } from "@prguard/scoring";
import { config, providerStatus } from "../config.js";
import { enrichProofAnalysis } from "./ai.js";
import type { ScanPr, ScanResult } from "./types.js";

interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  user?: { login?: string };
  created_at: string;
}

interface GitHubCommit {
  sha: string;
  commit?: {
    message?: string;
    author?: { name?: string; date?: string };
  };
}

interface GitHubFile {
  filename: string;
  additions: number;
  deletions: number;
  patch?: string;
}

interface GitHubComment {
  body?: string;
  user?: { login?: string };
  path?: string;
  created_at?: string;
}

export class RepoUrlError extends Error {
  constructor(message = "Use a GitHub repository URL like https://github.com/owner/repo or owner/repo.") {
    super(message);
    this.name = "RepoUrlError";
  }
}

export function parseRepoUrl(repoUrl: string) {
  const trimmed = repoUrl.trim();
  const shorthand = trimmed.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (shorthand) return { owner: shorthand[1], name: shorthand[2], url: `https://github.com/${shorthand[1]}/${shorthand[2]}` };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new RepoUrlError();
  }
  if (url.hostname !== "github.com") throw new RepoUrlError("Only github.com repositories are supported.");
  const [owner, name] = url.pathname.replace(/^\/|\.git$/g, "").split("/");
  if (!owner || !name) throw new RepoUrlError();
  return { owner, name, url: `https://github.com/${owner}/${name}` };
}

async function githubFetch<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "PRGuard-Hackathon",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 403 && /rate limit/i.test(body)) {
      throw new Error("GitHub public API rate limit reached. Add GITHUB_TOKEN for higher limits, reduce PRGUARD_MAX_PRS, or retry after the limit resets.");
    }
    throw new Error(`GitHub API ${response.status}: ${body.slice(0, 180)}`);
  }

  return (await response.json()) as T;
}

async function githubPaginated<T>(path: string, token?: string, maxPages = 3): Promise<T[]> {
  const results: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const chunk = await githubFetch<T[]>(`${path}${separator}per_page=30&page=${page}`, token);
    results.push(...chunk);
    if (chunk.length < 30) break;
  }
  return results;
}

export async function scanGitHubRepository(repoUrl: string, requestToken?: string): Promise<ScanResult> {
  const repo = parseRepoUrl(repoUrl);
  const token = requestToken || config.githubToken || undefined;
  const maxPullRequests = config.maxPullRequests || (token ? 20 : 6);
  const [repoMeta, pulls] = await Promise.all([
    githubFetch<{ private?: boolean }>(`/repos/${repo.owner}/${repo.name}`, token),
    githubPaginated<GitHubPullRequest>(`/repos/${repo.owner}/${repo.name}/pulls?state=all&sort=updated&direction=desc`, token, 2)
  ]);

  const selectedPulls = pulls.slice(0, maxPullRequests);
  const pullRequests: ScanPr[] = [];

  for (const pr of selectedPulls) {
    const [files, commits, comments, reviewComments] = await Promise.all([
      githubPaginated<GitHubFile>(`/repos/${repo.owner}/${repo.name}/pulls/${pr.number}/files`, token, 2),
      githubPaginated<GitHubCommit>(`/repos/${repo.owner}/${repo.name}/pulls/${pr.number}/commits`, token, 2),
      githubPaginated<GitHubComment>(`/repos/${repo.owner}/${repo.name}/issues/${pr.number}/comments`, token, 1),
      githubPaginated<GitHubComment>(`/repos/${repo.owner}/${repo.name}/pulls/${pr.number}/comments`, token, 1)
    ]);

    const normalized = {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      author: pr.user?.login ?? "unknown",
      url: pr.html_url,
      createdAt: pr.created_at,
      body: pr.body ?? "",
      files: files.map((file) => ({
        filename: file.filename,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch
      })),
      commits: commits.map((commit) => ({
        sha: commit.sha,
        message: commit.commit?.message ?? "",
        author: commit.commit?.author?.name,
        date: commit.commit?.author?.date
      })),
      comments: [...comments, ...reviewComments].map((comment) => ({
        body: comment.body ?? "",
        author: comment.user?.login,
        path: comment.path,
        date: comment.created_at
      }))
    };

    const score = scoreArtifact({
      kind: "pull_request",
      title: normalized.title,
      body: normalized.body,
      files: normalized.files,
      commits: normalized.commits,
      comments: normalized.comments
    });
    const proofInput = {
      mode: "code_review",
      kind: "pull_request",
      title: normalized.title,
      body: normalized.body,
      files: normalized.files,
      commits: normalized.commits,
      comments: normalized.comments
    } as const;
    const proof = analyzeProof(proofInput);

    pullRequests.push({
      ...normalized,
      score,
      proof
    });
  }

  const topRiskIds = new Set([...pullRequests].sort((a, b) => b.score.score - a.score.score).slice(0, config.aiScanLimit).map((pr) => pr.id));
  for (const pr of pullRequests) {
    if (!topRiskIds.has(pr.id)) continue;
    const proofInput = {
      mode: "code_review",
      kind: "pull_request",
      title: pr.title,
      body: pr.body,
      files: pr.files,
      commits: pr.commits,
      comments: pr.comments
    } as const;
    pr.proof = await enrichProofAnalysis(pr.proof, proofInput);
  }

  return {
    id: `${repo.owner}-${repo.name}-${Date.now()}`,
    source: "github",
    repository: {
      ...repo,
      private: repoMeta.private
    },
    createdAt: new Date().toISOString(),
    providerStatus: providerStatus(),
    summary: summarize(pullRequests),
    pullRequests
  };
}

function summarize(pullRequests: ScanPr[]): ScanResult["summary"] {
  const scores = pullRequests.map((pr) => pr.score.score);
  const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / Math.max(scores.length, 1));
  return {
    totalPrs: pullRequests.length,
    averageScore: average,
    clean: pullRequests.filter((pr) => pr.score.band === "Clean").length,
    review: pullRequests.filter((pr) => pr.score.band === "Review").length,
    flag: pullRequests.filter((pr) => pr.score.band === "Flag").length,
    block: pullRequests.filter((pr) => pr.score.band === "Block").length,
    topRisk: [...pullRequests].sort((a, b) => b.score.score - a.score.score).slice(0, 5)
  };
}
