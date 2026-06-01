# PRGuard

**Human Proof Scanner for Slop Scan 2026**

PRGuard detects content that looks finished but lacks proof that a human actually understood, reviewed, or owned it. It is built around one question:

```text
Is there enough human proof here to trust this?
```

Instead of only guessing whether something was AI-written, PRGuard checks whether the artifact contains real evidence: intent, examples, tests, ownership, metrics, deadlines, rollback plans, and supported claims.

## Live App

| Item | Link |
|---|---|
| App | https://pqguard.vercel.app/ |
| API health | https://pqguard.onrender.com/api/health |
| Primary track | Track A - Code Review |
| Extra coverage | Track B - Docs, Track C - Hiring, Track D - Communications |

## Judge Workflow

1. Pick one of the four tracks.
2. Paste text, upload a supported file, or scan a GitHub repository.
3. PRGuard extracts the content and runs the track-specific proof checks.
4. The report shows the verdict, Hollow Score, Human Proof Score, proof gaps, claim map, reviewer questions, and fix plan.
5. The user can copy questions, copy the fix plan, export reports, or generate a CI Gate workflow.

## The Four Tracks

### Track A - Code Review

**Use case:** detect pull requests that sound reviewable but do not prove intent, risk, testing, or rollback.

**Inputs:**

- GitHub repository URL or `owner/repo`
- Pasted PR title/body/diff summary/reviewer notes

**What PRGuard checks:**

- Does the PR explain why the change exists?
- Do the claims match changed files or diff content?
- Are tests or verification steps included?
- Are risky files, auth/payment/config changes, or migrations called out?
- Is there a rollback or failure plan?
- Are commit messages specific enough for review?

**Example demo:** scan `kubernetes/kubernetes`, then open a ranked risky PR to inspect proof gaps and claim evidence.

### Track B - Docs & KBs

**Use case:** detect documentation that reads well but cannot actually guide a reader.

**Inputs:**

- Pasted README/docs/KB text
- PDF, TXT, or Markdown upload

**What PRGuard checks:**

- Are there concrete steps a reader can follow?
- Are examples, commands, snippets, or usage blocks present?
- Is expected output or success behavior shown?
- Does the doc avoid circular wording?
- Is the document type handled fairly, such as README, runbook, API reference, or curated resource list?

**Example demo:** paste a README section and show whether it has commands, examples, and expected output.

### Track C - Hiring & Resumes

**Use case:** detect resumes or hiring writeups with impressive claims but weak proof.

**Inputs:**

- Pasted resume, cover letter, portfolio, or take-home text
- Resume PDF/TXT/MD upload under 500 KB

**What PRGuard checks:**

- Are outcomes measurable?
- Is owned work clearly stated?
- Are tools, projects, teams, or artifacts named?
- Are impact claims supported by evidence?
- Does the writeup avoid generic "led impact" language without proof?

**PDF flow:** resume PDFs are parsed on the backend first. If text is extracted, PRGuard auto-fills the textarea and runs analysis. AI extraction is only a fallback for hard PDFs.

### Track D - Communications

**Use case:** detect workplace messages that sound polished but do not create action.

**Inputs:**

- Pasted Slack message
- Email
- Meeting note
- Status update

**What PRGuard checks:**

- Is there a clear ask or decision?
- Is an owner named?
- Is a deadline or timing included?
- Is the next action explicit?
- Is corporate filler hiding the missing action?

**Example demo:** paste a vague alignment message and show missing ask, owner, deadline, and next action.

## What The Report Shows

- **Verdict:** Clean, Needs Review, or High Risk.
- **Hollow Score:** how polished-but-empty the artifact appears.
- **Human Proof Score:** how much concrete evidence is present.
- **Success Rate:** estimated readiness based on AI confidence and guardrails.
- **Proof Gaps:** the exact missing evidence.
- **AI Proof Report:** cause, merits, demerits, and recommended fixes.
- **Guardrail Check:** deterministic fallback checks that keep the report reviewable.
- **Reviewer Questions:** the shortest useful questions to ask next.
- **Claim Map:** supported, partial, or vague claims.

## How Detection Works

PRGuard uses a hybrid engine:

1. **Deterministic guardrails** check track-specific proof signals.
2. **Hollow Score** measures low-substance polish.
3. **Claim extraction** maps claims against nearby evidence.
4. **AI report generation** writes the readable explanation when available.
5. **Fallback scoring** keeps analysis working even when AI providers fail.

This is not a GPTZero clone. PRGuard judges proof quality, not just authorship.

## Evaluation

Run:

```bash
npm run evaluate
```

Current local baseline on 240 labeled examples:

```text
Accuracy:            0.88
False positive rate: 0.00
False negative rate: 0.00

Per-track:
  Code Review:    0.92
  Docs & KBs:     0.87
  Hiring:         0.88
  Communications: 0.87
```

These are review-aid metrics, not a 100% accuracy guarantee.

## Demo Script

1. Open https://pqguard.vercel.app/
2. **Track A repo scan:** enter `kubernetes/kubernetes` and show ranked PR risks.
3. **Track A manual:** paste a PR description and show the proof report.
4. **Track B:** paste/upload docs and show missing examples or expected output.
5. **Track C:** upload a resume PDF under 500 KB and show auto-fill plus analysis.
6. **Track D:** paste a vague workplace update and show the missing ask, owner, timing, and action.
7. Open **CI Gate** and generate the GitHub Actions workflow.

## Quickstart

Use Node.js 22.13.0 or newer.

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Commands

```bash
npm run dev       # start API and web app
npm run build     # build all workspaces
npm run lint      # lint all workspaces
npm run evaluate  # run local evaluation
npm run check     # lint + build + evaluate
```

## Deployment

Backend on Render:

```text
Root Directory:   leave blank
Build Command:    npm ci --include=dev && npm --workspace @prguard/scoring run build && npm --workspace @prguard/api run build
Start Command:    npm --workspace @prguard/api run start
Health Check:     /api/health
```

Frontend on Vercel:

```text
Framework Preset:  Vite
Build Command:     npm --workspace @prguard/web run build
Output Directory:  apps/web/dist
```

## API

```text
GET  /api/health
GET  /api/health/db
POST /api/scan
POST /api/analyze
POST /api/proof/analyze
POST /api/files/extract-pdf
POST /api/ci-yaml
POST /api/report
```

## Architecture

```text
Vite React app
  |
  v
Express API
  |-- GitHub ingestion
  |-- PDF text extraction
  |-- AI report generation
  |-- CI workflow generator
  |-- exports
  v
@prguard/scoring
  |-- Hollow Score
  |-- Human Proof Score
  |-- Track guardrails
  |-- Claim extraction
```

## Known Limits

- Track C resume uploads are capped at 500 KB.
- Text-based PDFs parse reliably; scanned/image-only PDFs may need AI/OCR fallback.
- AI reports depend on provider availability and rate limits.
- Conservative scoring may mark thin but acceptable content as Needs Review.
- GitHub rate limits apply without a token.

## License

MIT
