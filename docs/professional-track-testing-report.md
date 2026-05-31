# PRGuard Professional Track Testing Report

Date: May 31, 2026

## Scope

This report covers fresh local end-to-end testing across all four PRGuard tracks:

- Track A - Code Review / GitHub PR scan
- Track B - Docs & KBs
- Track C - Hiring & Resumes
- Track D - Communications
- AI proof review layer
- Export/report generation

## Runtime

Local services:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:4100
```

Health check:

```json
{
  "ok": true,
  "name": "PRGuard API",
  "providerStatus": {
    "github": true,
    "gemini": true,
    "groq": true,
    "huggingFace": true,
    "ollama": true,
    "heuristics": true
  }
}
```

## Track A - Code Review

Source:

```text
https://github.com/expressjs/express
```

Endpoint:

```text
POST /api/scan
```

Result:

| Metric | Value |
| --- | ---: |
| Pull requests analyzed | 20 |
| Average Hollow Score | 34 |
| Clean | 16 |
| Review | 4 |
| Flag | 0 |
| Block | 0 |

Top ranked PR risks:

| PR | Title | Hollow | Proof | Verdict | Main proof gaps |
| --- | --- | ---: | ---: | --- | --- |
| #5539 | [deleted] | 51 | 37 | High Risk | Intent explained; Diff supports claims; Risk or rollback noted |
| #7279 | Update Readme.md | 49 | 20 | Blocker | Intent explained; Diff supports claims; Tests or verification present; Risk or rollback noted |
| #7276 | Update scorecard.yml | 48 | 17 | Blocker | Intent explained; Diff supports claims; Tests or verification present; Risk or rollback noted; Commit messages specific |
| #7278 | Fixed: #7274 | 42 | 43 | High Risk | Intent explained; Tests or verification present; Risk or rollback noted; Commit messages specific |
| #7292 | fix: resolve variable shadowing in acceptParams | 39 | 32 | High Risk | Diff supports claims; Tests or verification present; Risk or rollback noted; Useful review comments |

Most common Track A proof gaps:

| Gap | Count |
| --- | ---: |
| Risk or rollback noted | 16 |
| Intent explained | 9 |
| Tests or verification present | 8 |
| Diff supports claims | 6 |
| Useful review comments | 5 |
| Commit messages specific | 2 |

AI review behavior:

```text
AI enrichment worked for the first three scanned PRs using Groq.
Later PRs were deterministic-only because repo scan AI enrichment is limited by PRGUARD_AI_SCAN_LIMIT.
```

Track A verdict:

```text
PASS. Live GitHub scanning works, PRs are ranked, verdicts are generated, proof gaps are visible, and exports are available.
```

## Track B - Docs & KBs

Source:

```text
https://raw.githubusercontent.com/vitejs/vite/main/README.md
```

Endpoint:

```text
POST /api/proof/analyze
```

Result:

| Metric | Value |
| --- | ---: |
| Words analyzed | 246 |
| Hollow Score | 32 |
| Hollow Band | Clean |
| Human Proof Score | 52 |
| Proof Band | Partial |
| Verdict | Needs Review |
| Claims checked | 2 |
| AI provider | Groq |
| AI safer rewrite | Generated |

Checklist result:

| Check | Status |
| --- | --- |
| Concrete example present | Passed |
| Step-by-step instruction present | Passed |
| Code or config snippet present | Passed |
| Expected output present | Passed |
| Avoids circular explanation | Passed |

Reviewer questions generated:

- What concrete example can a reader follow?
- What exact steps and expected output prove this works?
- Which claim needs a code snippet or configuration sample?

Track B verdict:

```text
PASS. Real public README analysis works. Deterministic scoring and AI review both responded.
```

## Track C - Hiring & Resumes

Source:

```text
Professional sanitized senior frontend resume excerpt.
```

Endpoint:

```text
POST /api/proof/analyze
```

Result:

| Metric | Value |
| --- | ---: |
| Words analyzed | 94 |
| Hollow Score | 17 |
| Hollow Band | Clean |
| Human Proof Score | 66 |
| Proof Band | Partial |
| Verdict | Needs Review |
| Claims checked | 3 |
| AI provider | Groq |
| AI safer rewrite | Generated |

Checklist result:

| Check | Status |
| --- | --- |
| Measurable outcomes | Passed |
| Specific tools or projects | Passed |
| Role-specific evidence | Passed |
| Avoids generic templating | Passed |
| Verifiable context | Passed |

Reviewer questions generated:

- What measurable outcome proves the strongest claim?
- Which project or artifact can verify this experience?
- What role-specific work did the candidate personally own?

Track C verdict:

```text
PASS. Sanitized resume analysis works and correctly recognizes measurable impact, tools, project evidence, and proof links.
```

## Track D - Communications

Source:

```text
Professional sanitized customer incident update.
```

Endpoint:

```text
POST /api/proof/analyze
```

Result:

| Metric | Value |
| --- | ---: |
| Words analyzed | 91 |
| Hollow Score | 19 |
| Hollow Band | Clean |
| Human Proof Score | 57 |
| Proof Band | Partial |
| Verdict | Needs Review |
| Claims checked | 3 |
| AI provider | Groq |
| AI safer rewrite | Generated |

Checklist result:

| Check | Status |
| --- | --- |
| Clear ask or decision | Passed |
| Owner present | Passed |
| Deadline or timing present | Passed |
| Next action present | Passed |
| Low corporate filler | Passed |

Reviewer questions generated:

- What is the exact ask or decision?
- Who owns the next action and by when?
- What can be removed so the message is shorter and clearer?

Track D verdict:

```text
PASS. Professional incident communication analysis works and recognizes owner, timing, decision, and next action.
```

## Export Testing

Track A scan exports were generated through:

```text
POST /api/report
```

| Format | Status | Size |
| --- | ---: | ---: |
| JSON | 200 | 229367 bytes |
| CSV | 200 | 15777 bytes |
| Markdown | 200 | 32337 bytes |
| PDF | 200 | 6537 bytes |

Export verdict:

```text
PASS. JSON, CSV, Markdown, and PDF exports all generated successfully.
```

## UI Smoke Test

Browser-tested:

- Desktop viewport at `http://localhost:5173`
- Mobile viewport at 390px width
- Track B input analysis
- Verdict card rendering
- Proof-focused labels
- Proof Review Summary panel
- Proof Gaps metric with zero-gap wording

UI verdict:

```text
PASS. The tested UI rendered without obvious overflow on desktop and 390px mobile.
```

## Automated Verification

Commands run:

```bash
npm run lint
npm run test
npm run build
npm run evaluate
```

Evaluation result:

```text
Examples: 240
Accuracy: 0.88
False positive rate: 0.00
False negative rate: 0.00
```

## Notes and Limitations

- Track A used a real live GitHub repository.
- Track B used a real public README from GitHub.
- Track C and Track D used professional sanitized examples to avoid exposing real personal or workplace data.
- Repo scan AI enrichment is intentionally limited by `PRGUARD_AI_SCAN_LIMIT`, so not every PR receives AI output.
- The deterministic proof engine remains active even when AI enrichment is unavailable.

## Final Verdict

```text
PRGuard has been freshly tested across Tracks A, B, C, and D with professional examples. All four tracks worked through live API paths. AI enrichment generated proof review output and safer rewrites for Tracks B, C, and D, and for the first enriched Track A PRs. Export generation passed for all supported formats.
```
