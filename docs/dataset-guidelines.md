# PRGuard Dataset Guidelines

Date: May 31, 2026

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

## Label Definitions

### clean

Content has enough concrete proof to be considered acceptable. It includes specific evidence such as file names, function names, endpoints, test names, metrics, tool names, owners, dates, deadlines, examples, expected outputs, command output, or links.

### review

Content has some useful signal but is incomplete. It should not be blocked as slop, but it needs human follow-up before full trust is given.

### slop

Content is vague, generic, circular, over-polished, unsupported, inflated, or missing essential evidence.

## Track Distribution

| Track | Mode | Clean | Review | Slop | Total |
| --- | --- | ---: | ---: | ---: | ---: |
| Track A - Code Review | `code_review` | 20 | 20 | 20 | 60 |
| Track B - Docs & KBs | `docs` | 20 | 20 | 20 | 60 |
| Track C - Hiring & Resumes | `hiring` | 20 | 20 | 20 | 60 |
| Track D - Communications | `communications` | 20 | 20 | 20 | 60 |
| Total | all modes | 80 | 80 | 80 | 240 |

## Evaluation Command

```bash
npm run evaluate
npm run evaluate -- --json
```

The JSON flag writes the latest machine-readable report to docs/evaluation-report.json.

## Current Evaluation Results

```text
total: 240
correct: 211
incorrect: 29
accuracy: 0.88
false positive rate: 0.00
false negative rate: 0.00
```

Per-track accuracy:

```text
code_review:     0.92
docs:            0.85
hiring:          0.88
communications: 0.87
```

Per-label accuracy:

```text
clean:  0.85
review: 0.96
slop:   0.82
```

## Prediction Rule

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

## Known Limitations

1. The dataset is still small for production.

240 examples are useful for a prototype benchmark but not production-grade evidence.

2. Examples are mostly synthetic or hand-authored.

They are calibrated to realistic scenarios, but future versions should include more sanitized real-world artifacts.

3. Track A examples are text-only.

The live app analyzes richer GitHub data including files, commits, comments, and diffs. The dataset should eventually support those fields.

4. Concise examples can still create boundary cases.

All examples are at least 20 words, but concise artifacts can still be harder to classify than longer documents.

5. Slop vs review is intentionally cautious.

Some slop examples are predicted as review. That is safer than predicting slop content as clean.

## Misclassified Examples

Current run has 29 misclassified examples. Main patterns:

- Compact clean examples with proof scores below the clean threshold.
- Review examples with enough missing checks to become slop.
- Slop examples that contain some concrete-looking language but still lack meaningful evidence.
- Concise examples that provide limited scoring surface even after expansion.

## Recommended Future Growth

- Expand from 240 to 400+ examples.
- Add full PR-shaped Track A examples with files, commits, comments, and diffs.
- Add longer README and KB excerpts with mixed quality.
- Add sanitized resumes and cover letters with job-role context.
- Add sanitized Slack/email/status updates from realistic workplace flows.
- Add examples that are concise but still clearly clean.
- Add examples that sound polished but remain unsupported.
