# PRGuard Evaluation Report

Date: May 31, 2026

## Dataset Version

Dataset file:

```text
docs/evaluation-dataset.json
```

Dataset size:

```text
240 examples
```

Distribution:

| Mode | Clean | Review | Slop | Total |
| --- | ---: | ---: | ---: | ---: |
| Track A - Code Review | `code_review` | 20 | 20 | 20 | 60 |
| Track B - Docs & KBs | `docs` | 20 | 20 | 20 | 60 |
| Track C - Hiring & Resumes | `hiring` | 20 | 20 | 20 | 60 |
| Track D - Communications | `communications` | 20 | 20 | 20 | 60 |
| Total | all modes | 80 | 80 | 80 | 240 |

## Evaluation Command

```bash
npm run evaluate
```

## Full Metric Results

```text
correct: 211
incorrect: 29
accuracy: 0.88
false positive rate: 0.00
false negative rate: 0.00
```

False positive rate means clean content predicted as slop.

False negative rate means slop content predicted as clean.

## Confusion Matrix

Rows are actual labels. Columns are predicted labels.

| Actual \ Predicted | Clean | Review | Slop |
| --- | ---: | ---: | ---: |
| Clean | 68 | 12 | 0 |
| Review | 0 | 77 | 3 |
| Slop | 0 | 14 | 66 |

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

Interpretation:

- Clean examples have the highest average Human Proof Score and no clean examples are classified as slop.
- Review examples are intentionally routed toward human follow-up when they contain explicit missing-evidence language.
- Slop examples have lower proof scores and more failed checks, while borderline slop is conservatively routed to review instead of clean.

## Prediction Rule Used

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

Most errors are cautious review-band errors. That is safer for this product than falsely marking weak content clean or falsely blocking clean content as slop.

## Warnings

The current evaluator reports no dataset warnings. Every example is at least 20 words, titles are unique, and the dataset schema validates.

## Conclusion

The evaluator is trustworthy enough for a prototype benchmark. It now reports honest metrics on a balanced 240-example dataset across Tracks A-D.

This is not production-grade accuracy. The dataset is still mostly synthetic, and Track A is text-only inside the benchmark. The best public claim is:

```text
PRGuard ships with a 240-example cross-track evaluation dataset and reports 0.88 accuracy, 0.00 false positive rate, 0.00 false negative rate, confusion matrix, per-track accuracy, per-label accuracy, score averages, JSON export, and misclassification diagnostics. These are honest prototype metrics, not production guarantees.
```
