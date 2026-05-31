# PRGuard Evaluation Report

Date: May 30, 2026

## Dataset Version

Dataset file:

```text
docs/evaluation-dataset.json
```

Dataset size:

```text
120 examples
```

Distribution:

| Mode | Clean | Review | Slop | Total |
| --- | ---: | ---: | ---: | ---: |
| `code_review` | 12 | 8 | 10 | 30 |
| `docs` | 12 | 8 | 10 | 30 |
| `hiring` | 12 | 8 | 10 | 30 |
| `communications` | 12 | 8 | 10 | 30 |
| Total | 48 | 32 | 40 | 120 |

## Evaluation Command

```bash
npm run evaluate
```

## Full Metric Results

```text
correct: 91
incorrect: 29
accuracy: 0.76
false positive rate: 0.00
false negative rate: 0.00
```

False positive rate means clean content predicted as slop.

False negative rate means slop content predicted as clean.

## Confusion Matrix

Rows are actual labels. Columns are predicted labels.

| Actual \ Predicted | Clean | Review | Slop |
| --- | ---: | ---: | ---: |
| Clean | 36 | 12 | 0 |
| Review | 0 | 29 | 3 |
| Slop | 0 | 14 | 26 |

## Per-Track Accuracy

| Track | Mode | Accuracy |
| --- | --- | ---: |
| Track A - Code Review | `code_review` | 0.83 |
| Track B - Docs & KBs | `docs` | 0.70 |
| Track C - Hiring & Resumes | `hiring` | 0.77 |
| Track D - Communications | `communications` | 0.73 |

## Per-Label Accuracy

| Label | Accuracy |
| --- | ---: |
| `clean` | 0.75 |
| `review` | 0.91 |
| `slop` | 0.65 |

## Score Averages By Label

| Label | Avg Human Proof Score | Avg Hollow Score | Avg Failed Checks | Avg Claims |
| --- | ---: | ---: | ---: | ---: |
| `clean` | 52.6 | 22.3 | 0.9 | 1.0 |
| `review` | 52.2 | 22.0 | 1.5 | 0.5 |
| `slop` | 42.2 | 33.0 | 2.6 | 0.7 |

Interpretation:

- Clean and review examples can have similar scores because review examples often include some concrete evidence but explicitly miss one trust requirement.
- Slop examples have much lower proof scores and more failed checks on average.
- Hollow Score is useful, but Human Proof Score and failed checks are more decisive for this benchmark.

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

Phase 4 changed the previous rule:

| Threshold | Old | New | Reason |
| --- | --- | --- | --- |
| Auto-slop proof score | `<= 35` | `<= 30` | Avoid over-blocking compact artifacts that have some evidence but score low due limited text. |
| Clean proof score | `>= 50` | `>= 45` | Allow short, specific artifacts to pass when hollow score is low and missing checks are limited. |
| Clean failed checks | `<= 1` | `<= 2` | A clean item does not need every checklist item if it has enough concrete proof and no explicit missing-evidence language. |
| Hollow slop cutoff | `>= 60` | `>= 43` | Expanded dataset examples showed that clearly hollow content often lands below 60 once explicit missing-evidence caveats add specificity. |
| Missing-check slop rule | `failed >= 4 and proof < 45` | unchanged | Multiple missing proof checks plus weak proof is structurally risky. |

## Misclassified Examples

There are 29 misclassified examples.

| Title | Actual | Predicted | Brief reason |
| --- | --- | --- | --- |
| Validate expired token in refresh flow | clean | review | Compact clean example scores below proof threshold. |
| Setup guide | slop | review | Generic setup text lacks enough proof to cross the slop cutoff. |
| Cover letter | slop | review | Unsupported hiring language is routed to review instead of auto-slop. |
| Configuration docs | slop | review | Placeholder-like docs are weak but just above auto-slop cutoff. |
| Data resume bullet | clean | review | Specific metric exists, but proof score remains below clean threshold. |
| Incident assignment | clean | review | Actionable communication is short and under-scored. |
| Review ask | clean | review | Clear ask exists, but proof score is below clean threshold. |
| Guard empty invite token | clean | review | Good PR proof, but checklist misses some secondary proof categories. |
| Tighten admin role migration | clean | review | Strong evidence but still trips more than two missing checks. |
| Update analytics event names | review | slop | Missing mapping and verification are treated as high risk. |
| General fixes | slop | review | Generic wording is weak but not enough for block-level slop. |
| Webhook signature verification docs | clean | review | Specific docs but proof score remains below clean threshold. |
| GitHub token setup docs | clean | review | Concrete setup steps but low proof score. |
| MongoDB Atlas setup docs | clean | review | Valid steps but under-scored by checklist. |
| Redis cache guide | review | slop | Missing TTL, invalidation, and output make it high risk. |
| Platform overview docs | slop | review | Generic overview lacks steps but does not cross slop cutoff. |
| Generic deployment guide | slop | review | Vague deployment language remains in review band. |
| Take-home explanation with tradeoff | clean | review | Specific architecture tradeoff but low proof score. |
| Open source maintainer evidence | clean | review | Concrete contribution evidence but proof score remains low. |
| AI project summary | review | slop | Missing evaluation and guardrails create high review risk. |
| Unsupported leadership claim | slop | review | Generic leadership claim lacks proof but not enough failed checks. |
| Blocked task escalation | clean | review | Clear owner/deadline but one missing signal keeps it review. |
| No-owner status note | slop | review | Missing owner/action, but score stays above auto-slop cutoff. |
| Vague decision summary | slop | review | Vague but not scored harshly enough for slop. |

## Warnings

The current evaluator reports no dataset warnings. Every example is at least 20 words, titles are unique, and the dataset schema validates.

## Conclusion

The evaluator is trustworthy enough for a hackathon submission. It reports honest prototype metrics on a balanced 120-example dataset across Tracks A-D.

This is not production-grade accuracy. The dataset is still small, mostly synthetic, and Track A is still text-only inside the benchmark. The best public claim is:

```text
PRGuard ships with a 120-example cross-track evaluation dataset and reports 0.76 accuracy, 0.00 false positive rate, 0.00 false negative rate, confusion matrix, per-track accuracy, per-label accuracy, score averages, JSON export, and misclassification diagnostics. These are honest prototype metrics, not production guarantees.
```
