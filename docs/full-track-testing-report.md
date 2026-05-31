# PRGuard Full Track Testing Report

Date: May 30, 2026

Scope:

- Track A - Code Review
- Track B - Docs & KBs
- Track C - Hiring & Resumes
- Track D - Communications
- Live API behavior
- One-page UI browser smoke
- Evaluation metrics
- Demo-route removal check

## Executive Result

Development testing status:

- [x] Track A tested with live GitHub repositories.
- [x] Track A tested with calibrated easy, medium, and high PR-like API cases.
- [x] Track B tested with easy, medium, and high documentation examples.
- [x] Track C tested with easy, medium, and high hiring/resume examples.
- [x] Track D tested with easy, medium, and high communications examples.
- [x] Frontend loaded in Chromium through Playwright.
- [x] No Demo Mode or seeded-data text appeared in the active UI.
- [x] Live text analysis worked through the browser UI.
- [x] Scan Repo modal opened through the browser UI.
- [x] `/api/demo` returned `404`.
- [x] `npm run lint` passed.
- [x] `npm run test` passed.
- [x] `npm run build` passed.
- [x] `npm run evaluate` passed.
- [x] `docker compose config --quiet` passed.

Verdict:

```text
Track A/B/C/D functionality is working locally through live API paths and the Tailwind one-page UI.
```

Submission caveat:

```text
Deployment and final hosted smoke tests are still required before final hackathon submission.
```

## Runtime Environment

Local services:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4100`

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

Demo route check:

```text
GET /api/demo -> 404
```

## Track A - Code Review

### Live GitHub Scan Coverage

Endpoint:

```text
POST /api/scan
```

Live public repositories scanned:

- `octocat/Hello-World`
- `expressjs/express`
- `vitejs/vite`

Total live PR analyses across this run:

```text
60 PRs
```

### Live Repository Results

| Repo | Total PRs | Average Hollow | Clean | Review | Flag | Block |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `octocat/Hello-World` | 20 | 40 | 15 | 2 | 2 | 1 |
| `expressjs/express` | 20 | 34 | 15 | 5 | 0 | 0 |
| `vitejs/vite` | 20 | 36 | 14 | 6 | 0 | 0 |

### Live PR Examples

| Level | Repo | PR | Title | Hollow | Band | Proof | Proof Band |
| --- | --- | --- | --- | ---: | --- | ---: | --- |
| Easy | `octocat/Hello-World` | `#9639` | `docs: add Tokyo weather snapshot (auto-generated)` | 21 | Clean | 31 | Weak |
| Medium | `octocat/Hello-World` | `#5` | `tst` | 41 | Review | 55 | Partial |
| High | `octocat/Hello-World` | `#9625` | `add login feature` | 76 | Flag | 20 | Missing |
| Easy | `expressjs/express` | `#7285` | `[OpenForge AI] Prototype pollution via query parser` | 15 | Clean | 30 | Weak |
| Medium | `expressjs/express` | `#7270` | `Support mixed-case request header lookups in req.get` | 41 | Review | 63 | Partial |
| Easy | `vitejs/vite` | `#22551` | `fix: update rolldown input messages` | 23 | Clean | 47 | Weak |
| Medium | `vitejs/vite` | `#22453` | `feat: integrate with Vite Task for zero-config build caching` | 41 | Review | 54 | Partial |

Observation:

- Live GitHub scanning is working.
- The latest PRs in `expressjs/express` and `vitejs/vite` did not produce high Hollow Score cases in the first 20 PRs.
- `octocat/Hello-World` produced the clearest high-risk live PR example.
- Some PRs with low Hollow Score still had low Human Proof Score. This is useful: it means PRGuard separates "sounds slop-like" from "has verifiable human proof."

### Calibrated Track A API Cases

Endpoint:

```text
POST /api/proof/analyze
```

| Case | Hollow | Band | Proof | Proof Band | Failed Checks | Claims |
| --- | ---: | --- | ---: | --- | ---: | ---: |
| A-easy: tested auth redirect fix | 27 | Clean | 61 | Partial | 1 | 2 |
| A-medium: cache update with partial proof | 32 | Clean | 24 | Missing | 5 | 1 |
| A-high: vague payment change | 55 | Review | 28 | Weak | 5 | 1 |

Track A conclusion:

```text
Track A is functional. The strongest risk signal is the combination of Hollow Score, Human Proof Score, failed proof checks, changed-file context, questions, and fix plan.
```

Improvement note:

```text
For a future version, high-risk sensitive-file cases should push Hollow Score harder when payment/auth/security files change without tests or rollback notes.
```

## Track B - Docs & KBs

Endpoint:

```text
POST /api/proof/analyze
```

| Case | Hollow | Band | Proof | Proof Band | Failed Checks | Claims |
| --- | ---: | --- | ---: | --- | ---: | ---: |
| B-easy: concrete setup docs | 17 | Clean | 57 | Partial | 0 | 0 |
| B-medium: useful but partial docs | 21 | Clean | 63 | Partial | 1 | 2 |
| B-high: circular filler docs | 25 | Clean | 44 | Weak | 4 | 1 |

Checks covered:

- [x] Concrete examples
- [x] Step-by-step instructions
- [x] Code/config snippets
- [x] Expected output
- [x] Circular explanation detection
- [x] Reader questions
- [x] Fix plan

Track B conclusion:

```text
Track B is functional. Weak docs are primarily detected through missing proof checks and low Human Proof Score rather than Hollow Score alone.
```

## Track C - Hiring & Resumes

Endpoint:

```text
POST /api/proof/analyze
```

| Case | Hollow | Band | Proof | Proof Band | Failed Checks | Claims |
| --- | ---: | --- | ---: | --- | ---: | ---: |
| C-easy: verified impact resume | 20 | Clean | 67 | Partial | 0 | 2 |
| C-medium: specific but missing metrics | 25 | Clean | 61 | Partial | 1 | 3 |
| C-high: generic unsupported claims | 26 | Clean | 24 | Missing | 4 | 1 |

Checks covered:

- [x] Measurable outcomes
- [x] Specific tools/projects
- [x] Role-specific evidence
- [x] Generic templated phrasing
- [x] Verifiable context
- [x] Recruiter questions
- [x] Evidence-request fix plan
- [x] No candidate accusation wording

Track C conclusion:

```text
Track C is functional. Generic resumes and cover letters are clearly pushed into Missing proof when they lack metrics, project evidence, and verification context.
```

## Track D - Communications

Endpoint:

```text
POST /api/proof/analyze
```

| Case | Hollow | Band | Proof | Proof Band | Failed Checks | Claims |
| --- | ---: | --- | ---: | --- | ---: | ---: |
| D-easy: clear owner and deadline | 19 | Clean | 58 | Partial | 0 | 0 |
| D-medium: next action but weak owner | 25 | Clean | 67 | Partial | 0 | 1 |
| D-high: inflated no-action update | 47 | Review | 21 | Missing | 5 | 1 |

Checks covered:

- [x] Clear ask or decision
- [x] Owner
- [x] Deadline/timing
- [x] Next action
- [x] Corporate filler
- [x] Signal-to-noise behavior through Hollow Score and proof checklist
- [x] Clarifying questions
- [x] Action-focused fix plan

Track D conclusion:

```text
Track D is functional. Inflated communication with no owner, deadline, or decision is detected as Missing proof and receives clarifying questions.
```

## Browser UI Smoke Test

Tool:

```text
Playwright Chromium
```

Browser checks:

- [x] Opened `http://localhost:5173`.
- [x] Confirmed no `Demo Mode`, `Seeded`, or `/api/demo` text was visible.
- [x] Clicked Docs mode.
- [x] Filled the live analysis textarea.
- [x] Clicked Analyze.
- [x] Waited for Human Proof Score to render.
- [x] Opened Scan Repo modal.

Result:

```text
browser-ui-smoke=pass
```

## Evaluation Metrics

Command:

```bash
npm run evaluate
```

Output:

```json
{
  "total": 120,
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

## Automated Verification

Commands:

```bash
npm run lint
npm run test
npm run build
npm run evaluate
docker compose config --quiet
```

Result:

```text
All passed.
```

## Remaining Testing Before Final Submission

Recommended before deployment:

- [ ] Test one private repo using a GitHub token.
- [ ] Test one repo with real security/auth/payment changes.
- [ ] Test one long README or docs page from a real open-source project.
- [ ] Test one real resume or cover letter sample with personal data removed.
- [ ] Test one real Slack/email/status update with sensitive data removed.
- [ ] Run deployed frontend and backend smoke tests after hosting.
- [ ] Run `docker compose up --build` after Docker Desktop engine is running.

## What I Need From You For Even Better Testing

Optional inputs:

- A public GitHub repo you want featured in the demo.
- A sanitized README/docs sample.
- A sanitized resume or cover letter sample.
- A sanitized Slack/email/status update.
- A preferred "hard case" repo with auth, payment, security, config, or migration PRs.

## Final Testing Verdict

```text
The full local project has been tested across Tracks A, B, C, and D with easy, medium, and high examples. Track A also passed live GitHub testing across 60 real PRs. The product is ready for deployment testing.
```
