import type { ArtifactInput, Evidence, HollowScoreResult, ScoreBand, ScoreComponent } from "./types.js";
import { average, clamp, cosineLikeSimilarity, excerptAround, sentences, standardDeviation, uniqueMeaningfulWords, words } from "./utils.js";

const FILLER_PHRASES = [
  "improved overall quality",
  "enhance user experience",
  "minor improvements",
  "various fixes",
  "code cleanup",
  "optimized performance",
  "streamlined workflow",
  "better maintainability",
  "robust solution",
  "seamless integration",
  "comprehensive update",
  "addressed feedback",
  "made changes",
  "updated logic",
  "refactored code",
  "ensure consistency",
  "best practices",
  "leverage",
  "utilize",
  "significantly improves"
];

const TECHNICAL_MARKERS = [
  "api",
  "route",
  "schema",
  "migration",
  "test",
  "cache",
  "token",
  "auth",
  "query",
  "index",
  "component",
  "endpoint",
  "database",
  "error",
  "validation",
  "config"
];

function combineText(input: ArtifactInput): string {
  const commitText = input.commits?.map((commit) => commit.message).join("\n") ?? "";
  const commentText = input.comments?.map((comment) => comment.body).join("\n") ?? "";
  return [input.title, input.body, commitText, commentText].filter(Boolean).join("\n\n");
}

function diffText(input: ArtifactInput): string {
  const fileText = input.files?.map((file) => `${file.filename}\n${file.patch ?? ""}`).join("\n") ?? "";
  return [input.diff, fileText].filter(Boolean).join("\n");
}

function fillerAnalysis(text: string) {
  const lower = text.toLowerCase();
  const hits = FILLER_PHRASES.filter((phrase) => lower.includes(phrase));
  const wordCount = Math.max(words(text).length, 1);
  const fillerRatio = clamp((hits.length / Math.max(wordCount / 45, 1)) * 100);
  return { hits, fillerRatio };
}

function informationDensity(text: string): number {
  const tokenList = words(text);
  if (!tokenList.length) return 0;
  const unique = uniqueMeaningfulWords(text);
  const markerHits = tokenList.filter((word) => TECHNICAL_MARKERS.includes(word)).length;
  const fileRefs = tokenList.filter((word) => /[/\\.]|tsx?|jsx?|json|yml|md|css|sql/.test(word)).length;
  const numbers = tokenList.filter((word) => /\d/.test(word)).length;
  const density = (unique.size / tokenList.length) * 70 + Math.min(markerHits * 4, 18) + Math.min(fileRefs * 3, 18) + Math.min(numbers * 2, 10);
  return clamp(density);
}

function styleUniformity(text: string): number {
  const sentenceList = sentences(text);
  if (sentenceList.length < 3) return 20;
  const lengths = sentenceList.map((sentence) => words(sentence).length);
  const deviation = standardDeviation(lengths);
  const repeatedStarts = sentenceList.filter((sentence, index, arr) => {
    const first = words(sentence)[0];
    return first && arr.findIndex((candidate) => words(candidate)[0] === first) !== index;
  }).length;
  const lowVariancePenalty = clamp(45 - deviation * 4, 0, 45);
  return clamp(lowVariancePenalty + repeatedStarts * 9);
}

function commitSimilarity(commits: ArtifactInput["commits"] = []): number {
  if (commits.length < 2) return 0;
  const pairs: number[] = [];
  for (let i = 0; i < commits.length; i += 1) {
    for (let j = i + 1; j < commits.length; j += 1) {
      pairs.push(cosineLikeSimilarity(commits[i].message, commits[j].message) * 100);
    }
  }
  return clamp(average(pairs));
}

function diffAlignment(description: string, diff: string): number {
  if (!description.trim() || !diff.trim()) return 45;
  return clamp(cosineLikeSimilarity(description, diff) * 100);
}

function bandFor(score: number): ScoreBand {
  if (score >= 80) return "Block";
  if (score >= 60) return "Flag";
  if (score >= 40) return "Review";
  return "Clean";
}

function actionFor(band: ScoreBand): string {
  if (band === "Block") return "Block or require a human-written explanation before merge.";
  if (band === "Flag") return "Ask the author to explain intent, risks, and tested behavior.";
  if (band === "Review") return "Have a reviewer inspect the description and commit trail.";
  return "No slop signal is strong enough to require action.";
}

function addEvidence(evidence: Evidence[], label: string, excerpt: string, severity: Evidence["severity"]) {
  if (excerpt.trim()) evidence.push({ label, excerpt: excerpt.replace(/\s+/g, " ").trim().slice(0, 260), severity });
}

export function scoreArtifact(input: ArtifactInput): HollowScoreResult {
  const text = combineText(input);
  const diff = diffText(input);
  const tokenCount = words(text).length;
  const density = informationDensity(text);
  const { hits, fillerRatio } = fillerAnalysis(text);
  const alignment = diffAlignment([input.title, input.body].filter(Boolean).join("\n"), diff);
  const uniformity = styleUniformity(text);
  const similarity = commitSimilarity(input.commits);

  const aiLike = clamp(fillerRatio * 0.55 + uniformity * 0.25 + Math.max(0, 45 - density) * 0.55 + similarity * 0.18);
  const densitySlop = clamp(100 - density);
  const alignmentGap = clamp(diff.trim() ? Math.abs(55 - alignment) + (alignment < 12 ? 25 : 0) : 35);
  const repetitionSlop = clamp(uniformity * 0.65 + similarity * 0.35);

  const components: ScoreComponent[] = [
    { name: "AI-likelihood", score: Math.round(aiLike), weight: 0.4, reason: "Generic wording, low specificity, and uniform writing style." },
    { name: "Information density", score: Math.round(densitySlop), weight: 0.3, reason: "Lower density means fewer concrete technical details per word." },
    { name: "Diff alignment gap", score: Math.round(alignmentGap), weight: 0.2, reason: "Compares stated intent with changed files and diff text." },
    { name: "Style uniformity", score: Math.round(repetitionSlop), weight: 0.1, reason: "Flags repeated templates across sentences and commits." }
  ];

  const weighted = components.reduce((sum, component) => sum + component.score * component.weight, 0);
  const emptyPenalty = tokenCount < 8 ? 35 : 0;
  const score = Math.round(clamp(weighted + emptyPenalty));
  const band = bandFor(score);
  const evidence: Evidence[] = [];

  for (const phrase of hits.slice(0, 5)) addEvidence(evidence, "Filler phrase", excerptAround(text, phrase), score > 70 ? "high" : "medium");
  if (density < 28) addEvidence(evidence, "Low information density", text.slice(0, 220), "high");
  if (alignment < 12 && diff.trim()) addEvidence(evidence, "Weak diff alignment", `${input.title ?? ""} ${input.body ?? ""}`.slice(0, 220), "high");
  if (similarity > 55) addEvidence(evidence, "Repeated commit pattern", input.commits?.map((commit) => commit.message).join(" | ") ?? "", "medium");
  if (uniformity > 55) addEvidence(evidence, "Uniform writing cadence", text.slice(0, 220), "medium");

  const reasons = components
    .filter((component) => component.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((component) => `${component.name}: ${component.reason}`);

  if (!reasons.length) reasons.push("Concrete wording and diff alignment look healthy.");

  return {
    score,
    band,
    action: actionFor(band),
    summary: band === "Clean" ? "This artifact has enough concrete signal to look reviewable." : "This artifact contains hollow or generic signals that deserve human review.",
    components,
    reasons,
    evidence,
    highlightedPhrases: hits,
    metrics: {
      wordCount: tokenCount,
      density: Math.round(density),
      fillerRatio: Math.round(fillerRatio),
      diffAlignment: Math.round(alignment),
      styleUniformity: Math.round(uniformity),
      commitSimilarity: Math.round(similarity)
    }
  };
}

export function detectUniversalContext(text: string): string {
  const lower = text.toLowerCase();
  if (/pull request|pr|merge|diff|commit|review/.test(lower)) return "Code review";
  if (/resume|experience|skills|candidate|hiring/.test(lower)) return "Resume";
  if (/slack|channel|standup|sync|team/.test(lower)) return "Team message";
  if (/documentation|guide|readme|api reference/.test(lower)) return "Documentation";
  return "General text";
}
