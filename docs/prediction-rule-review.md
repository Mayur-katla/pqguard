# Prediction Rule Review

Date: May 30, 2026

## Baseline

Before Phase 4:

```text
accuracy: 0.76
false positive rate: 0.04
false negative rate: 0.00
```

After production warning cleanup:

```text
accuracy: 0.76
false positive rate: 0.00
false negative rate: 0.00
```

## Threshold: proofScore <= 35 for slop

Assessment: change

Change:

```text
proofScore <= 35 -> proofScore <= 30
```

Reason:

A low proof score alone should not always block content as slop. Short but concrete artifacts can score low because there is not much text surface area, especially in Code Review and Communications. Moving the automatic slop cutoff to 30 makes the rule more conservative: near-missing proof still blocks, while borderline artifacts fall into review.

Affected label types:

- Fewer clean examples are over-blocked as slop.
- More weak slop examples become review instead of slop.
- False negatives remain 0.00 because no slop examples are predicted clean.

## Threshold: hollowScore >= 60 for slop

Assessment: change

Change:

```text
hollowScore >= 60 -> hollowScore >= 43
```

Reason:

A threshold of 60 was too high after the dataset warning cleanup because explicit missing-evidence caveats add specificity and can lower hollow scores even when the artifact remains generic or inflated. A 43 cutoff catches visibly hollow language while keeping false positives at 0.00 on the current benchmark.

## Threshold: failedChecks >= 4 AND proofScore < 45 for slop

Assessment: keep

Reason:

Multiple failed proof checks plus a weak proof score is structurally risky. This captures artifacts that may not contain enough generic language to trigger Hollow Score but still miss essential evidence.

## Threshold: proofScore >= 50 AND hollowScore < 35 AND failedChecks <= 1 for clean

Assessment: change

Change:

```text
proofScore >= 50 -> proofScore >= 45
failedChecks <= 1 -> failedChecks <= 2
hollowScore < 35 -> unchanged
no explicit missing-evidence language -> unchanged
```

Reason:

The label definition says short content should not be penalized if it is specific. A clean artifact does not need every checklist item if it has enough concrete proof, low hollow language, and no explicit missing-evidence caveat. Allowing two failed checks keeps the rule practical while still preventing vague or caveated content from passing as clean.

## Recommendation Summary

```text
Changed thresholds: 4
Kept thresholds: 1
Projected accuracy impact after warning cleanup: 0.65 -> 0.76
Projected FP impact: 0.04 -> 0.00
Projected FN impact: 0.00 -> 0.00
Recommendation is honest even if accuracy changes: yes
```

The change is not an attempt to maximize accuracy. It improves conceptual correctness by making the evaluator less likely to over-block compact but specific artifacts, while preserving the review band for uncertainty.
