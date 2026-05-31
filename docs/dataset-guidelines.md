# PRGuard Dataset Guidelines

Date: May 30, 2026

## Dataset Purpose

PRGuard is a Human Proof Scanner. The dataset measures whether content has concrete proof, ownership, verification, evidence, or reviewability.

It does not try to prove whether content was literally AI-generated. The core evaluation claim is:

```text
This content lacks verifiable evidence that a human understood or reviewed it.
```

## Dataset Structure

Dataset file:

```text
docs/evaluation-dataset.json
```

Each item uses this schema:

```json
{
  "mode": "code_review | docs | hiring | communications",
  "label": "clean | review | slop",
  "title": "Short artifact title",
  "text": "Artifact text to analyze"
}
```

| Field | Purpose |
| --- | --- |
| `mode` | Selects the track-specific proof checklist. |
| `label` | Human-authored expected review outcome. |
| `title` | Short label for diagnostics and reports. |
| `text` | Artifact text scored by the evaluator. |

## Label Definitions

### clean

Content has enough concrete proof to be considered acceptable. It includes specific evidence such as file names, function names, endpoints, test names, metrics, tool names, owners, dates, deadlines, examples, expected outputs, command output, or links. Short content is not penalized if it is specific.

### review

Content has some useful signal but is incomplete. It should not be blocked as slop, but it needs human follow-up before full trust is given. It may be missing one of: owner, expected output, rollback step, verification detail, metric, link, deadline, or decision. The gap is real but not disqualifying.

### slop

Content is vague, generic, circular, over-polished, unsupported, inflated, or missing essential evidence. Language patterns include but are not limited to: "best practices," "seamless workflow," "comprehensive update," "proven track record," "holistic outcomes," "circle back," "strategic alignment," "impactful results," "robust solution," or "industry-leading" when used without concrete backing.

## Track Distribution

| Track | Mode | Clean | Review | Slop | Total |
| --- | --- | ---: | ---: | ---: | ---: |
| Track A - Code Review | `code_review` | 12 | 8 | 10 | 30 |
| Track B - Docs & KBs | `docs` | 12 | 8 | 10 | 30 |
| Track C - Hiring & Resumes | `hiring` | 12 | 8 | 10 | 30 |
| Track D - Communications | `communications` | 12 | 8 | 10 | 30 |
| Total | all modes | 48 | 32 | 40 | 120 |

## Evaluation Command

Run:

```bash
npm run evaluate
```

The command builds the scoring package, validates the dataset, runs every example through `analyzeProof`, predicts a label, and prints metrics.

Supported flags:

```text
npm run evaluate -- --json
```

The `--json` flag writes the latest machine-readable report to `docs/evaluation-report.json`.

## Metric Meanings

| Metric | Meaning |
| --- | --- |
| Accuracy | Share of examples where predicted label matches human label. |
| False positive rate | Share of clean examples incorrectly predicted as slop. |
| False negative rate | Share of slop examples incorrectly predicted as clean. |
| Confusion matrix | Actual labels by predicted labels. |
| Per-track accuracy | Accuracy within each mode. |
| Per-label accuracy | Accuracy within each expected label. |
| Score averages by label | Average proof and hollow scores for clean, review, and slop examples. |

## Current Evaluation Results

Current result after Phase 4 prediction rule review:

```text
total: 120
correct: 91
incorrect: 29
accuracy: 0.76
false positive rate: 0.00
false negative rate: 0.00
```

Per-track accuracy:

```text
code_review:     0.83
docs:            0.70
hiring:          0.77
communications: 0.73
```

Per-label accuracy:

```text
clean:  0.75
review: 0.91
slop:   0.65
```

## Prediction Rule

Current rule:

```text
Predict slop when:
- proofScore <= 30, OR
- Hollow Score >= 43, OR
- failed proof checks >= 4 and proofScore < 45

Predict clean when:
- proofScore >= 45,
- Hollow Score < 35,
- failed checks <= 2,
- and the text does not explicitly say something is missing

Otherwise predict review.
```

Why this rule is intentionally conservative:

- Very low proof remains slop.
- Strongly hollow language remains slop.
- Multiple missing proof checks can still block.
- Compact but specific content can pass as clean.
- Ambiguous content falls into review instead of being over-blocked.

## Known Limitations

1. The dataset is still small.

120 examples are useful for a hackathon benchmark but not production-grade evidence.

2. Examples are mostly synthetic or hand-authored.

They are calibrated to realistic scenarios, but future versions should include more sanitized real-world artifacts.

3. Track A examples are text-only.

The live app analyzes richer GitHub data including files, commits, comments, and diffs. The dataset should eventually support those fields.

4. Concise examples can still create boundary cases.

All examples are now at least 20 words, but concise artifacts can still be harder to classify than longer documents.

5. Slop vs review is intentionally cautious.

Some slop examples are predicted as review. That is safer than predicting slop content as clean.

## Misclassified Examples

Current run has 29 misclassified examples. Main patterns:

- Compact clean examples with proof scores below the clean threshold.
- Review examples with enough missing checks to become slop.
- Slop examples that contain some concrete-looking language but still lack meaningful evidence.
- Concise examples that provide limited scoring surface even after expansion.

Representative titles:

- `Validate expired token in refresh flow`
- `Production deploy guide`
- `Modernize components`
- `Webhook signature verification docs`
- `GitHub token setup docs`
- `Take-home explanation with tradeoff`
- `Unsupported leadership claim`
- `No-owner status note`
- `Vague decision summary`

## Recommended Future Growth

- Expand from 120 to 200+ examples.
- Add full PR-shaped Track A examples with files, commits, comments, and diffs.
- Add longer README and KB excerpts with mixed quality.
- Add sanitized resumes and cover letters with job-role context.
- Add sanitized Slack/email/status updates from realistic workplace flows.
- Add examples that are concise but still clearly clean.
- Add examples that sound polished but remain unsupported.
