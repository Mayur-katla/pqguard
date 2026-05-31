# PRGuard Evaluation Dataset Report

Date: May 31, 2026

Dataset file:

```text
docs/evaluation-dataset.json
```

Evaluation command:

```bash
npm run evaluate
```

## Executive Summary

PRGuard's evaluation dataset now contains **240 labelled examples** across the four implemented SlopScan tracks:

- Track A - Code Review
- Track B - Docs & KBs
- Track C - Hiring & Resumes
- Track D - Communications

The dataset is balanced across tracks and labels. It tests PRGuard's core hypothesis:

```text
Content becomes risky when it looks complete but lacks concrete proof, verification, ownership, or evidence.
```

Current evaluation result:

```json
{
  "total": 240,
  "correct": 211,
  "incorrect": 29,
  "accuracy": 0.88,
  "falsePositiveRate": 0,
  "falseNegativeRate": 0,
  "perTrackAccuracy": {
    "code_review": 0.92,
    "docs": 0.85,
    "hiring": 0.88,
    "communications": 0.87
  }
}
```

These are honest prototype metrics, not production guarantees.

## Dataset Purpose

The dataset is not trying to prove whether text was literally AI-generated. It tests whether an artifact has verifiable evidence that a human understood, verified, reviewed, or owned the work.

The labels represent practical review outcomes:

- clean: enough proof to be considered acceptable.
- review: some signal, but human follow-up is needed.
- slop: vague, unsupported, circular, inflated, or missing essential proof.

## Track Distribution

The dataset has exactly **60 examples per track**.

| Track | Mode | Clean | Review | Slop | Total |
| --- | --- | ---: | ---: | ---: | ---: |
| Track A - Code Review | `code_review` | 20 | 20 | 20 | 60 |
| Track B - Docs & KBs | `docs` | 20 | 20 | 20 | 60 |
| Track C - Hiring & Resumes | `hiring` | 20 | 20 | 20 | 60 |
| Track D - Communications | `communications` | 20 | 20 | 20 | 60 |
| Total | all modes | 80 | 80 | 80 | 240 |

## Scoring Method Used For Evaluation

The evaluator runs each dataset item through analyzeProof, then converts the detailed proof result into a predicted label using Human Proof Score, Hollow Score, failed proof checks, and explicit caveat text such as missing, needs, unclear, or unsupported.

## Current Confusion Matrix

Rows are actual labels. Columns are predicted labels.

| Actual \ Predicted | Clean | Review | Slop |
| --- | ---: | ---: | ---: |
| Clean | 68 | 12 | 0 |
| Review | 0 | 77 | 3 |
| Slop | 0 | 14 | 66 |

## Accuracy Metrics

| Metric | Value |
| --- | ---: |
| Total examples | 240 |
| Correct predictions | 211 |
| Incorrect predictions | 29 |
| Accuracy | 0.88 |
| False positive rate | 0.00 |
| False negative rate | 0.00 |

Interpretation:

- The evaluator does not classify any labelled slop examples as clean.
- It does not classify any labelled clean examples as slop.
- The main tradeoff is conservative review classification.
- This fits the product goal: review assistance instead of automatic accusation.

## Per-Track Accuracy

| Track | Mode | Accuracy |
| --- | --- | ---: |
| Track A - Code Review | `code_review` | 0.92 |
| Track B - Docs & KBs | `docs` | 0.85 |
| Track C - Hiring & Resumes | `hiring` | 0.88 |
| Track D - Communications | `communications` | 0.87 |

## Per-Label Accuracy

| Label | Accuracy |
| --- | ---: |
| `clean` | 0.85 |
| `review` | 0.96 |
| `slop` | 0.82 |

## Score Averages By Label

| Label | Avg Human Proof Score | Avg Hollow Score | Avg Failed Checks | Avg Claims |
| --- | ---: | ---: | ---: | ---: |
| `clean` | 55.6 | 22.7 | 0.6 | 0.9 |
| `review` | 51.4 | 23.4 | 1.1 | 0.3 |
| `slop` | 39.0 | 36.2 | 3.1 | 0.8 |

## Misclassified Examples

There are 29 misclassified examples. Representative cases:

| Title | Actual | Predicted | Proof | Hollow |
| --- | --- | --- | ---: | ---: |
| Validate expired token in refresh flow | clean | review | 42 | 23 |
| Setup guide | slop | review | 46 | 25 |
| Cover letter | slop | review | 40 | 24 |
| Resume summary | slop | review | 43 | 23 |
| Email | slop | review | 58 | 23 |
| Platform overview | slop | review | 53 | 22 |
| Configuration docs | slop | review | 44 | 26 |
| Data resume bullet | clean | review | 43 | 22 |
| Incident assignment | clean | review | 37 | 23 |
| Meeting summary | slop | review | 59 | 24 |
| Review ask | clean | review | 42 | 24 |
| Team sync | slop | review | 58 | 24 |

Important conclusion:

```text
Most errors are cautious review-band errors. That is safer than falsely marking weak content clean or falsely blocking clean content as slop.
```

## Track Coverage

Track A examples cover PR descriptions, file paths, tests, rollback/risk gaps, auth, billing, migrations, cache, and polished-but-empty PR language.

Track B examples cover setup docs, API quickstarts, webhook docs, Docker instructions, deployment, configuration, and expected output.

Track C examples cover resume bullets, cover letters, take-home summaries, portfolio claims, leadership claims, and open-source contribution claims.

Track D examples cover Slack updates, email follow-ups, incident updates, launch decisions, meeting summaries, and customer escalations.

## Known Weaknesses

1. The dataset is still small for production.

240 examples are useful for prototype evidence but not enough for production benchmarking.

2. Examples are mostly synthetic or hand-authored.

The live app has been tested against real GitHub PRs, but the evaluation dataset itself should include more real-world artifacts later.

3. Text-only examples limit Track A realism.

Track A production scans include files, commits, comments, and diffs. The dataset currently stores title and text only.

4. Concise examples remain boundary cases.

All examples are at least 20 words and the evaluator reports no dataset warnings. Some concise artifacts still remain harder to classify than longer real-world documents.

## Recommended Dataset Expansion

For a stronger post-hackathon benchmark, expand from 240 to 400+ examples:

- Real public GitHub PR descriptions with files and commit metadata.
- Real open-source README sections.
- Sanitized resume/cover letter samples.
- Sanitized Slack/email/status updates.
- Long-form examples with mixed clean and slop sections.
- Edge cases where concise text is actually good.
- Edge cases where polished text is still unsupported.

## Final Dataset Verdict

```text
The current PRGuard evaluation dataset is hackathon-ready: balanced across Tracks A-D, label-aware, measurable, and honest about limitations.
```

Best way to present it:

```text
PRGuard ships with a 240-example cross-track evaluation dataset and reports 0.88 accuracy, 0.00 false positive rate, 0.00 false negative rate, confusion matrix, per-track accuracy, per-label accuracy, score averages, JSON export, and misclassification diagnostics. We treat these as honest prototype metrics, not production claims.
```
