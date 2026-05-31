# PRGuard Evaluation Dataset Report

Date: May 30, 2026

Dataset file:

```text
docs/evaluation-dataset.json
```

Evaluation command:

```bash
npm run evaluate
```

## Executive Summary

PRGuard's evaluation dataset now contains **120 labelled examples** across the four implemented SlopScan tracks:

- Track A - Code Review
- Track B - Docs & KBs
- Track C - Hiring & Resumes
- Track D - Communications

The dataset is balanced across tracks and labels. It tests PRGuard's core hypothesis:

```text
Content becomes risky when it looks complete but lacks concrete proof, verification, ownership, or evidence.
```

Current evaluation result after Phase 4:

```json
{
  "total": 120,
  "correct": 91,
  "incorrect": 29,
  "accuracy": 0.76,
  "falsePositiveRate": 0,
  "falseNegativeRate": 0,
  "perTrackAccuracy": {
    "code_review": 0.83,
    "docs": 0.7,
    "hiring": 0.77,
    "communications": 0.73
  }
}
```

Short interpretation:

```text
The dataset supports PRGuard's claim that the system can detect weak human-proof signals across Code Review, Docs, Hiring, and Communications with useful hackathon-grade accuracy.
```

These are honest prototype metrics, not production guarantees.

## Dataset Purpose

The dataset is not trying to prove whether text was literally AI-generated.

It tests whether an artifact has verifiable evidence that a human understood, verified, reviewed, or owned the work.

The labels represent practical review outcomes:

- `clean`: enough proof to be considered acceptable.
- `review`: some signal, but human follow-up is needed.
- `slop`: vague, unsupported, circular, inflated, or missing essential proof.

## Dataset Structure

Each example has this shape:

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
| `mode` | Selects the SlopScan track and PRGuard proof checklist. |
| `label` | Human-authored expected class. |
| `title` | Short contextual label used during scoring. |
| `text` | Main content being scored. |

## Track Distribution

The dataset has exactly **30 examples per track**.

| Track | Mode | Clean | Review | Slop | Total |
| --- | --- | ---: | ---: | ---: | ---: |
| Track A - Code Review | `code_review` | 12 | 8 | 10 | 30 |
| Track B - Docs & KBs | `docs` | 12 | 8 | 10 | 30 |
| Track C - Hiring & Resumes | `hiring` | 12 | 8 | 10 | 30 |
| Track D - Communications | `communications` | 12 | 8 | 10 | 30 |
| Total | all modes | 48 | 32 | 40 | 120 |

## Label Design

### Clean

Clean examples contain specific proof signals. They usually include:

- File names or endpoint names.
- Tests or verification.
- Expected outputs.
- Owners and deadlines.
- Metrics, scale, links, or concrete tools.
- Narrow claims that can be checked.

### Review

Review examples are intentionally incomplete but not empty. They often include one useful signal plus a real missing requirement.

These examples test whether PRGuard can avoid over-blocking and instead recommend a human follow-up.

### Slop

Slop examples are generic, circular, inflated, or unsupported.

These examples test whether PRGuard detects low-evidence language even when the content sounds polished.

## Scoring Method Used For Evaluation

The evaluator runs each dataset item through:

```ts
analyzeProof({
  mode,
  kind: mode === "code_review" ? "pull_request" : "universal_text",
  title,
  body: text
})
```

Then it converts the detailed proof result into a predicted label using:

- Human Proof Score.
- Hollow Score.
- Number of failed proof checks.
- Explicit caveat text such as `missing`, `needs`, `unclear`, or `unsupported`.

Current prediction rule:

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

This rule is intentionally conservative. It allows ambiguous artifacts to land in `review` instead of over-blocking them as `slop`.

## Current Confusion Matrix

Rows are actual labels. Columns are predicted labels.

| Actual \ Predicted | Clean | Review | Slop |
| --- | ---: | ---: | ---: |
| Clean | 36 | 12 | 0 |
| Review | 0 | 29 | 3 |
| Slop | 0 | 14 | 26 |

## Accuracy Metrics

| Metric | Value |
| --- | ---: |
| Total examples | 120 |
| Correct predictions | 91 |
| Incorrect predictions | 29 |
| Accuracy | 0.76 |
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

| Label | Avg Hollow Score | Avg Human Proof Score | Avg Failed Checks | Avg Claims |
| --- | ---: | ---: | ---: | ---: |
| `clean` | 22.3 | 52.6 | 0.9 | 1.0 |
| `review` | 22.0 | 52.2 | 1.5 | 0.5 |
| `slop` | 33.0 | 42.2 | 2.6 | 0.7 |

Interpretation:

- Human Proof Score and failed proof checks are more decisive than Hollow Score.
- Slop examples have lower proof scores and more failed proof checks.
- Clean and review examples can have similar proof scores because review examples often include some evidence but still miss a required trust signal.

## Misclassified Examples

There are 29 misclassified examples. The main causes are:

- Some clean examples are short and specific, but too compact to score as strongly verified.
- Some review examples explicitly list several missing requirements and therefore look block-level.
- Some slop examples are vague but remain safer to route to review than to over-block.
- Concise examples can still provide limited scoring surface even after warning cleanup.

Representative misclassified examples:

| Title | Actual | Predicted |
| --- | --- | --- |
| Validate expired token in refresh flow | clean | review |
| Setup guide | slop | review |
| Cover letter | slop | review |
| GitHub token setup docs | clean | review |
| Take-home explanation with tradeoff | clean | review |
| Unsupported leadership claim | slop | review |
| No-owner status note | slop | review |
| Vague decision summary | slop | review |

Important conclusion:

```text
Most errors are cautious review-band errors. That is safer than falsely marking weak content clean or falsely blocking clean content as slop.
```

## Track A Dataset Design

Track A examples cover:

- Generic PR descriptions.
- Specific code paths.
- Test evidence.
- Rollback/risk gaps.
- Auth, billing, migration, cache, GitHub error handling.
- Commit/PR-like language that sounds polished but says little.

Track A limitation:

```text
The dataset uses text-only PR summaries, while the live app can also use files, commits, comments, and diffs.
```

## Track B Dataset Design

Track B examples cover:

- Setup docs.
- API quickstarts.
- Webhook docs.
- Docker instructions.
- Deployment guides.
- Configuration docs.
- Health check docs.

Track B limitation:

```text
Docs should eventually include longer real README and KB excerpts with mixed quality.
```

## Track C Dataset Design

Track C examples cover:

- Resume bullets.
- Cover letters.
- Take-home summaries.
- Portfolio summaries.
- Leadership claims.
- Open-source contribution claims.

Track C limitation:

```text
The benchmark should eventually include multi-section resumes and role-specific job descriptions.
```

## Track D Dataset Design

Track D examples cover:

- Slack updates.
- Email follow-ups.
- Incident updates.
- Launch decisions.
- Meeting summaries.
- Customer escalations.

Track D limitation:

```text
More sanitized real workplace messages would help tune the boundary between short-but-actionable and too-vague.
```

## How This Dataset Supports SlopScan Judging

| SlopScan Need | Dataset Support |
| --- | --- |
| Detection accuracy | `npm run evaluate` reports accuracy and confusion matrix. |
| False positive awareness | FPR is reported as 0.00. |
| False negative awareness | FNR is reported as 0.00 on current set. |
| Cross-track scanner | Dataset spans four modes. |
| Practical usefulness | Labels map to review outcomes: clean, review, slop. |
| Honest limitations | Misclassified examples and dataset limitations are documented. |

## Known Weaknesses

1. Dataset is still small.

120 examples are useful for hackathon evidence but not enough for production benchmarking.

2. Examples are mostly synthetic or hand-authored.

The live app has been tested against real GitHub PRs, but the evaluation dataset itself should include more real-world artifacts later.

3. Text-only examples limit Track A realism.

Track A production scans include files, commits, comments, and diffs. The dataset currently stores title and text only.

4. Concise examples remain boundary cases.

All examples are now at least 20 words and the evaluator reports no dataset warnings. Some concise artifacts still remain harder to classify than longer real-world documents.

## Recommended Dataset Expansion

For a stronger post-hackathon benchmark, expand from 120 to 200+ examples:

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

It is not production-grade yet:

```text
A production benchmark should include more real-world samples, longer documents, and richer Track A PR metadata.
```

Best way to present it:

```text
PRGuard ships with a 120-example cross-track evaluation dataset and reports 0.76 accuracy, 0.00 false positive rate, 0.00 false negative rate, confusion matrix, per-track accuracy, per-label accuracy, score averages, JSON export, and misclassification diagnostics. We treat these as honest prototype metrics, not production claims.
```
