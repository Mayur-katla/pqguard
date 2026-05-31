import { readFileSync, writeFileSync } from "node:fs";
import { analyzeProof } from "../packages/scoring/dist/index.js";

const datasetUrl = new URL("../docs/evaluation-dataset.json", import.meta.url);
const reportUrl = new URL("../docs/evaluation-report.json", import.meta.url);
const writeJsonReport = process.argv.includes("--json");
const modes = ["code_review", "docs", "hiring", "communications"];
const labels = ["clean", "review", "slop"];

function readDataset() {
  try {
    const parsed = JSON.parse(readFileSync(datasetUrl, "utf8"));
    if (!Array.isArray(parsed)) {
      throw new Error("Dataset root must be a JSON array.");
    }
    return parsed;
  } catch (error) {
    console.error(`Failed to read docs/evaluation-dataset.json: ${error.message}`);
    process.exit(1);
  }
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function emptyCounts() {
  return {
    total: 0,
    byTrack: Object.fromEntries(modes.map((mode) => [mode, 0])),
    byLabel: Object.fromEntries(labels.map((label) => [label, 0]))
  };
}

function validateDataset(dataset) {
  const errors = [];
  const warnings = [];
  const seenTitles = new Map();
  const summary = emptyCounts();

  dataset.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`Item ${index}: expected an object.`);
      return;
    }

    const { mode, label, title, text } = item;
    if (!modes.includes(mode)) errors.push(`Item ${index}: invalid mode "${mode}".`);
    if (!labels.includes(label)) errors.push(`Item ${index}: invalid label "${label}".`);
    if (typeof title !== "string" || !title.trim()) errors.push(`Item ${index}: missing non-empty title.`);
    if (typeof text !== "string" || !text.trim()) errors.push(`Item ${index}: missing non-empty text.`);

    if (typeof title === "string" && title.trim()) {
      const normalizedTitle = title.trim().toLowerCase();
      if (seenTitles.has(normalizedTitle)) {
        warnings.push(`Duplicate title "${title}" at items ${seenTitles.get(normalizedTitle)} and ${index}.`);
      } else {
        seenTitles.set(normalizedTitle, index);
      }
    }

    if (typeof text === "string" && text.trim() && wordCount(text) < 20) {
      warnings.push(`Item ${index} "${title}": text has fewer than 20 words.`);
    }

    if (modes.includes(mode)) summary.byTrack[mode] += 1;
    if (labels.includes(label)) summary.byLabel[label] += 1;
    summary.total += 1;
  });

  return { errors, warnings, summary };
}

function predictedLabel(result, item) {
  const failed = result.missingProof.filter((proofItem) => !proofItem.passed).length;
  const text = `${item.title} ${item.text}`.toLowerCase();
  const explicitCaveat =
    /missing|needs?|not described|unclear|unsupported|no concrete|no supporting|but (gives|lists|provides|includes|names|states)?\s*no|but no|does not name|no .*evidence|no .*owner|no .*deadline|no .*decision|no .*action/.test(
      text
    );
  if (result.proofScore <= 30 || result.hollowScore.score >= 43 || (failed >= 4 && result.proofScore < 45)) return "slop";
  if (result.proofScore >= 45 && result.hollowScore.score < 35 && failed <= 2 && !explicitCaveat) return "clean";
  return "review";
}

function average(values) {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function pct(numerator, denominator) {
  return Number((numerator / Math.max(denominator, 1)).toFixed(2));
}

function formatNumber(value) {
  return value.toFixed ? value.toFixed(2) : String(value);
}

function printReport(report) {
  console.log("Dataset summary:");
  console.log(`  total: ${report.dataset.total}`);
  console.log(`  per track: ${JSON.stringify(report.dataset.byTrack)}`);
  console.log(`  per label: ${JSON.stringify(report.dataset.byLabel)}`);
  console.log("");

  console.log("Results:");
  console.log(`  correct: ${report.results.correct}`);
  console.log(`  incorrect: ${report.results.incorrect}`);
  console.log(`  accuracy: ${formatNumber(report.results.accuracy)}`);
  console.log(`  false positive rate: ${formatNumber(report.results.falsePositiveRate)}  (clean predicted as slop)`);
  console.log(`  false negative rate: ${formatNumber(report.results.falseNegativeRate)}  (slop predicted as clean)`);
  console.log("");

  console.log("Confusion matrix:");
  console.log("  predicted ->   clean   review   slop");
  for (const label of labels) {
    const row = report.confusionMatrix[label];
    console.log(`  actual ${label.padEnd(6)} ${String(row.clean).padStart(5)} ${String(row.review).padStart(8)} ${String(row.slop).padStart(6)}`);
  }
  console.log("");

  console.log("Per-track accuracy:");
  for (const mode of modes) {
    console.log(`  ${mode.padEnd(15)} ${formatNumber(report.perTrackAccuracy[mode])}`);
  }
  console.log("");

  console.log("Per-label accuracy:");
  for (const label of labels) {
    console.log(`  ${label.padEnd(7)} ${formatNumber(report.perLabelAccuracy[label])}`);
  }
  console.log("");

  console.log("Score averages by label:");
  for (const label of labels) {
    const score = report.scoreAveragesByLabel[label];
    console.log(`  ${label.padEnd(7)} -> proofScore avg: ${score.proofScore}, hollowScore avg: ${score.hollowScore}, failedChecks avg: ${score.failedChecks}, claims avg: ${score.claims}`);
  }
  console.log("");

  console.log(`Misclassified examples (${report.misclassified.length} total):`);
  if (report.misclassified.length === 0) {
    console.log("  none");
  } else {
    for (const item of report.misclassified) {
      console.log(`  [${item.title}] | actual: ${item.actual} | predicted: ${item.predicted} | proofScore: ${item.proofScore} | hollowScore: ${item.hollowScore}`);
    }
  }
  console.log("");

  console.log("Warnings:");
  if (report.warnings.length === 0) {
    console.log("  none");
  } else {
    for (const warning of report.warnings) console.log(`  ${warning}`);
  }
}

const dataset = readDataset();
const validation = validateDataset(dataset);

if (validation.errors.length) {
  console.error("Dataset validation failed:");
  for (const error of validation.errors) console.error(`  ${error}`);
  process.exit(1);
}

const matrix = Object.fromEntries(labels.map((actual) => [actual, Object.fromEntries(labels.map((predicted) => [predicted, 0]))]));
const byMode = Object.fromEntries(modes.map((mode) => [mode, { total: 0, correct: 0 }]));
const byLabel = Object.fromEntries(labels.map((label) => [label, { total: 0, correct: 0 }]));
const scoreBuckets = Object.fromEntries(labels.map((label) => [label, { proofScore: [], hollowScore: [], failedChecks: [], claims: [] }]));
const misclassified = [];

let correct = 0;
let falsePositive = 0;
let falseNegative = 0;

for (const item of dataset) {
  const result = analyzeProof({
    mode: item.mode,
    kind: item.mode === "code_review" ? "pull_request" : "universal_text",
    title: item.title,
    body: item.text
  });
  const predicted = predictedLabel(result, item);
  const failedChecks = result.missingProof.filter((proofItem) => !proofItem.passed).length;

  matrix[item.label][predicted] += 1;
  byMode[item.mode].total += 1;
  byLabel[item.label].total += 1;
  scoreBuckets[item.label].proofScore.push(result.proofScore);
  scoreBuckets[item.label].hollowScore.push(result.hollowScore.score);
  scoreBuckets[item.label].failedChecks.push(failedChecks);
  scoreBuckets[item.label].claims.push(result.claims.length);

  if (predicted === item.label) {
    correct += 1;
    byMode[item.mode].correct += 1;
    byLabel[item.label].correct += 1;
  } else {
    misclassified.push({
      title: item.title,
      mode: item.mode,
      actual: item.label,
      predicted,
      proofScore: result.proofScore,
      hollowScore: result.hollowScore.score,
      failedChecks
    });
  }

  if (predicted === "slop" && item.label === "clean") falsePositive += 1;
  if (predicted === "clean" && item.label === "slop") falseNegative += 1;
}

const total = dataset.length;
const report = {
  dataset: validation.summary,
  results: {
    correct,
    incorrect: total - correct,
    accuracy: pct(correct, total),
    falsePositiveRate: pct(falsePositive, validation.summary.byLabel.clean),
    falseNegativeRate: pct(falseNegative, validation.summary.byLabel.slop)
  },
  confusionMatrix: matrix,
  perTrackAccuracy: Object.fromEntries(modes.map((mode) => [mode, pct(byMode[mode].correct, byMode[mode].total)])),
  perLabelAccuracy: Object.fromEntries(labels.map((label) => [label, pct(byLabel[label].correct, byLabel[label].total)])),
  scoreAveragesByLabel: Object.fromEntries(
    labels.map((label) => [
      label,
      {
        proofScore: average(scoreBuckets[label].proofScore),
        hollowScore: average(scoreBuckets[label].hollowScore),
        failedChecks: average(scoreBuckets[label].failedChecks),
        claims: average(scoreBuckets[label].claims)
      }
    ])
  ),
  misclassified,
  warnings: validation.warnings
};

if (writeJsonReport) {
  writeFileSync(reportUrl, `${JSON.stringify(report, null, 2)}\n`);
}

printReport(report);

if (writeJsonReport) {
  console.log("");
  console.log("JSON report written to docs/evaluation-report.json");
}
