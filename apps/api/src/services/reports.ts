import PDFDocument from "pdfkit";
import type { ScanResult } from "./types.js";

export function toCsv(scan: ScanResult) {
  const rows = [
    ["number", "title", "author", "hollow_score", "hollow_band", "proof_score", "proof_band", "reasons"],
    ...scan.pullRequests.map((pr) => [
      String(pr.number),
      pr.title,
      pr.author,
      String(pr.score.score),
      pr.score.band,
      String(pr.proof?.proofScore ?? ""),
      pr.proof?.proofBand ?? "",
      pr.score.reasons.join(" | ")
    ])
  ];
  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
}

export function toMarkdown(scan: ScanResult) {
  const lines = [
    `# PRGuard Report: ${scan.repository.owner}/${scan.repository.name}`,
    "",
    `Created: ${scan.createdAt}`,
    `Average Hollow Score: ${scan.summary.averageScore}`,
    "",
    "| PR | Title | Hollow | Proof | Band |",
    "| --- | --- | ---: | ---: | --- |",
    ...scan.pullRequests.map((pr) => `| #${pr.number} | ${pr.title.replace(/\|/g, "\\|")} | ${pr.score.score} | ${pr.proof?.proofScore ?? ""} | ${pr.score.band} |`)
  ];
  return lines.join("\n");
}

export async function toPdf(scan: ScanResult): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 48 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.fontSize(22).text("PRGuard Hollow Score Report");
  doc.moveDown();
  doc.fontSize(12).text(`${scan.repository.owner}/${scan.repository.name}`);
  doc.text(`Created: ${scan.createdAt}`);
  doc.text(`Average Hollow Score: ${scan.summary.averageScore}`);
  doc.moveDown();

  for (const pr of scan.pullRequests) {
    doc.fontSize(14).text(`#${pr.number} ${pr.title}`);
    doc.fontSize(11).text(`Score: ${pr.score.score} (${pr.score.band})`);
    if (pr.proof) doc.text(`Human Proof: ${pr.proof.proofScore} (${pr.proof.proofBand})`);
    doc.text(pr.score.summary);
    if (pr.proof) doc.text(pr.proof.summary);
    for (const reason of pr.score.reasons.slice(0, 3)) doc.text(`- ${reason}`);
    doc.moveDown(0.6);
  }

  doc.end();
  return done;
}
