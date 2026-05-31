import PDFDocument from "pdfkit";
import type { ScanPr, ScanResult } from "./types.js";
import { maskSensitiveText } from "./privacy.js";

interface ExportAiReview {
  summary?: string;
  strengths: string[];
  weaknesses: string[];
  issues: string[];
  recommendations: string[];
  rewrite?: string;
}

function csvEscape(cell: string | number | undefined) {
  return `"${String(cell ?? "").replace(/"/g, '""')}"`;
}

function failedGaps(pr: ScanPr) {
  return pr.proof.missingProof.filter((item) => !item.passed);
}

function sanitizePr(pr: ScanPr): ScanPr {
  const proofWithAi = pr.proof as ScanPr["proof"] & { aiReview?: ExportAiReview };
  const aiReview = proofWithAi.aiReview
    ? {
        ...proofWithAi.aiReview,
        summary: proofWithAi.aiReview.summary ? maskSensitiveText(proofWithAi.aiReview.summary) : proofWithAi.aiReview.summary,
        strengths: proofWithAi.aiReview.strengths.map(maskSensitiveText),
        weaknesses: proofWithAi.aiReview.weaknesses.map(maskSensitiveText),
        issues: proofWithAi.aiReview.issues.map(maskSensitiveText),
        recommendations: proofWithAi.aiReview.recommendations.map(maskSensitiveText),
        rewrite: proofWithAi.aiReview.rewrite ? maskSensitiveText(proofWithAi.aiReview.rewrite) : proofWithAi.aiReview.rewrite
      }
    : undefined;

  return {
    ...pr,
    title: maskSensitiveText(pr.title),
    author: maskSensitiveText(pr.author),
    body: maskSensitiveText(pr.body),
    commits: pr.commits.map((commit) => ({
      ...commit,
      message: maskSensitiveText(commit.message),
      author: commit.author ? maskSensitiveText(commit.author) : commit.author
    })),
    comments: pr.comments.map((comment) => ({
      ...comment,
      body: maskSensitiveText(comment.body),
      author: comment.author ? maskSensitiveText(comment.author) : comment.author
    })),
    proof: {
      ...pr.proof,
      verdictReason: maskSensitiveText(pr.proof.verdictReason),
      nextAction: maskSensitiveText(pr.proof.nextAction),
      summary: maskSensitiveText(pr.proof.summary),
      questions: pr.proof.questions.map(maskSensitiveText),
      fixPlan: pr.proof.fixPlan.map((step) => ({ ...step, title: maskSensitiveText(step.title), detail: maskSensitiveText(step.detail) })),
      claims: pr.proof.claims.map((claim) => ({
        ...claim,
        claim: maskSensitiveText(claim.claim),
        evidence: claim.evidence.map(maskSensitiveText),
        missing: claim.missing.map(maskSensitiveText)
      })),
      ...(aiReview ? { aiReview } : {})
    }
  };
}

export function sanitizeScanReport(scan: ScanResult): ScanResult {
  const pullRequests = scan.pullRequests.map(sanitizePr);
  const topNumbers = new Set(scan.summary.topRisk.map((pr) => pr.number));
  return {
    ...scan,
    repository: { ...scan.repository, url: maskSensitiveText(scan.repository.url) },
    summary: {
      ...scan.summary,
      topRisk: pullRequests.filter((pr) => topNumbers.has(pr.number)).sort((a, b) => b.score.score - a.score.score).slice(0, scan.summary.topRisk.length)
    },
    pullRequests
  };
}

export function toCsv(scanInput: ScanResult) {
  const scan = sanitizeScanReport(scanInput);
  const rows = [
    ["number", "title", "author", "verdict", "next_action", "hollow_score", "hollow_band", "proof_score", "proof_band", "proof_gaps", "recommended_fixes", "reviewer_questions"],
    ...scan.pullRequests.map((pr) => [
      String(pr.number),
      pr.title,
      pr.author,
      pr.proof.verdictLabel,
      pr.proof.nextAction,
      String(pr.score.score),
      pr.score.band,
      String(pr.proof.proofScore),
      pr.proof.proofBand,
      failedGaps(pr).map((gap) => gap.label).join(" | "),
      pr.proof.fixPlan.map((step) => `${step.title}: ${step.detail}`).join(" | "),
      pr.proof.questions.join(" | ")
    ])
  ];
  return rows.map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");
}

export function toMarkdown(scanInput: ScanResult) {
  const scan = sanitizeScanReport(scanInput);
  const top = scan.summary.topRisk[0];
  const lines = [
    `# PRGuard Proof Report: ${scan.repository.owner}/${scan.repository.name}`,
    "",
    `Created: ${scan.createdAt}`,
    "Track: Code Review / GitHub Repository Scan",
    `Average Hollow Score: ${scan.summary.averageScore}`,
    `Pull Requests Analyzed: ${scan.summary.totalPrs}`,
    "",
    "## Repository Verdict",
    "",
    top ? `**${top.proof.verdictLabel}** - Start with PR #${top.number}. ${top.proof.nextAction}` : "No high-risk pull request was identified.",
    "",
    "## Score Summary",
    "",
    "| PR | Title | Verdict | Hollow | Proof | Proof Gaps | Next Action |",
    "| --- | --- | --- | ---: | ---: | ---: | --- |",
    ...scan.pullRequests.map((pr) => `| #${pr.number} | ${pr.title.replace(/\|/g, "\\|")} | ${pr.proof.verdictLabel} | ${pr.score.score} | ${pr.proof.proofScore} | ${failedGaps(pr).length} | ${pr.proof.nextAction.replace(/\|/g, "\\|")} |`),
    "",
    "## Detailed Proof Gaps and Fix Plan",
    "",
    ...scan.pullRequests.flatMap((pr) => [
      `### PR #${pr.number}: ${pr.title}`,
      "",
      `Verdict: **${pr.proof.verdictLabel}**`,
      `Reason: ${pr.proof.verdictReason}`,
      `Next Action: ${pr.proof.nextAction}`,
      "",
      "**Evidence Found**",
      ...(pr.proof.missingProof.filter((item) => item.passed).length ? pr.proof.missingProof.filter((item) => item.passed).map((item) => `- ${item.label}: ${item.detail}`) : ["- None recorded."]),
      "",
      "**Proof Gaps**",
      ...(failedGaps(pr).length ? failedGaps(pr).map((gap) => `- ${gap.label} (${gap.severity}): ${gap.detail}`) : ["- No open proof gaps."]),
      "",
      "**Recommended Fixes**",
      ...pr.proof.fixPlan.map((step) => `- ${step.title}: ${step.detail}`),
      "",
      "**Reviewer Questions**",
      ...pr.proof.questions.map((question) => `- ${question}`),
      ""
    ]),
    "---",
    "Privacy note: exported reports mask emails, phone numbers, profile URLs, bearer tokens, and GitHub-style tokens by default."
  ];
  return lines.join("\n");
}

function drawDivider(doc: PDFKit.PDFDocument) {
  const y = doc.y + 6;
  doc.moveTo(48, y).lineTo(564, y).strokeColor("#CBD5E1").lineWidth(0.5).stroke();
  doc.moveDown(1);
}

export async function toPdf(scanInput: ScanResult): Promise<Buffer> {
  const scan = sanitizeScanReport(scanInput);
  const doc = new PDFDocument({ margin: 48, size: "A4" });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.fontSize(22).fillColor("#0F172A").text("PRGuard Proof Report");
  doc.fontSize(11).fillColor("#475569").text("Human Proof Scanner for evidence, ownership, verification, and reviewability");
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Repository: ${scan.repository.owner}/${scan.repository.name}`);
  doc.text("Track: Code Review / GitHub Repository Scan");
  doc.text(`Created: ${scan.createdAt}`);
  doc.text(`Average Hollow Score: ${scan.summary.averageScore}   PRs: ${scan.summary.totalPrs}   Flag/Block: ${scan.summary.flag + scan.summary.block}`);
  drawDivider(doc);

  const top = scan.summary.topRisk[0];
  doc.fontSize(15).fillColor("#0F172A").text("Repository Verdict");
  if (top) {
    doc.fontSize(12).fillColor("#111827").text(`${top.proof.verdictLabel}: Start with PR #${top.number}`);
    doc.fontSize(10).fillColor("#475569").text(top.proof.verdictReason, { width: 500 });
    doc.fontSize(10).fillColor("#334155").text(`Next Action: ${top.proof.nextAction}`, { width: 500 });
  } else {
    doc.fontSize(10).fillColor("#475569").text("No top risk identified.");
  }
  drawDivider(doc);

  doc.fontSize(15).fillColor("#0F172A").text("Ranked PR Queue");
  doc.moveDown(0.4);

  for (const pr of scan.pullRequests.slice(0, 12)) {
    if (doc.y > 720) doc.addPage();
    const gaps = failedGaps(pr);
    doc.fontSize(12).fillColor("#111827").text(`#${pr.number} ${pr.title}`, { width: 500 });
    doc.fontSize(9).fillColor("#475569").text(`Verdict: ${pr.proof.verdictLabel} | Hollow: ${pr.score.score} (${pr.score.band}) | Proof: ${pr.proof.proofScore} (${pr.proof.proofBand}) | Proof Gaps: ${gaps.length}`);
    doc.fontSize(9).fillColor("#475569").text(`Reason: ${pr.proof.verdictReason}`, { width: 500 });
    doc.fontSize(9).fillColor("#334155").text(`Next Action: ${pr.proof.nextAction}`, { width: 500 });
    if (gaps.length) doc.fontSize(9).fillColor("#7F1D1D").text(`Top Gap: ${gaps[0].label} - ${gaps[0].detail}`, { width: 500 });
    doc.moveDown(0.75);
  }

  doc.addPage();
  doc.fontSize(15).fillColor("#0F172A").text("Proof Gaps and Reviewer Questions");
  doc.moveDown(0.4);

  for (const pr of scan.pullRequests.slice(0, 8)) {
    if (doc.y > 720) doc.addPage();
    const gaps = failedGaps(pr);
    doc.fontSize(11).fillColor("#111827").text(`#${pr.number} ${pr.title}`, { width: 500 });
    doc.fontSize(9).fillColor("#475569").text("Proof Gaps:");
    if (gaps.length) {
      for (const gap of gaps.slice(0, 3)) doc.text(`- ${gap.label}: ${gap.detail}`, { width: 500 });
    } else {
      doc.text("- No open proof gaps.");
    }
    doc.fontSize(9).fillColor("#475569").text("Recommended Fixes:");
    for (const step of pr.proof.fixPlan.slice(0, 3)) doc.text(`- ${step.title}: ${step.detail}`, { width: 500 });
    doc.moveDown(0.75);
  }

  doc.fontSize(8).fillColor("#64748B").text("Privacy note: emails, phone numbers, profile URLs, bearer tokens, and GitHub-style tokens are masked in this export.", 48, 780, { width: 500 });
  doc.end();
  return done;
}
