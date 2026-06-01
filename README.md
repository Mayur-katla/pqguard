# PRGuard

Human Proof Scanner for Slop Scan 2026.

PRGuard finds content that looks complete but lacks proof that a human understood, verified, or owned it. It scans GitHub pull requests, documentation, resumes, take-home writeups, and workplace messages, then returns a concise proof report with a Hollow Score, Human Proof Score, proof gaps, reviewer questions, claim evidence, and a fix plan.

```text
Winning angle: PRGuard does not ask "was this AI-generated?"
It asks: "Is there enough human proof to trust this?"
```

## Live Submission

| Item | Link |
| --- | --- |
| Live app | https://pqguard.vercel.app/ |
| API health | https://pqguard.onrender.com/api/health |
| Primary hackathon track | Track A - Code Review |
| Cross-track coverage | Track B Docs, Track C Hiring, Track D Communications |

## Why This Exists

AI-generated slop is not always obviously wrong. The dangerous cases are polished, confident, and empty:

- A PR description that repeats the diff but never explains risk.
- A README that sounds helpful but has no concrete example.
- A resume that lists impressive claims without proof of owned work.
- A Slack update that expands one vague thought into three paragraphs.

PRGuard turns those weak signals into reviewable evidence so a human can decide faster.

## What It Does

| Track | Input | What PRGuard Checks |
| --- | --- | --- |
| A - Code Review | GitHub repo scan or pasted PR text | Intent, diff support, tests, review signal, risky files, rollback proof, commit specificity. |
| B - Docs & KBs | Pasted docs or uploaded PDF/TXT/MD | Concrete steps, examples, snippets, expected output, circular wording, reader proof. |
| C - Hiring & Resumes | Pasted resume text or uploaded PDF/TXT/MD | Measurable outcomes, owned work, tool/project evidence, unsupported claims, generic phrasing. |
| D - Communications | Pasted Slack/email/status text | Clear ask or decision, owner, timing, next action, inflated corporate filler. |

## Core Features

- Live GitHub pull request scanner for public repos.
- Optional GitHub token support for higher rate limits and private repos.
- Manual Track A textarea for analyzing one PR artifact without scanning a full repository.
- AI-first report generation when provider keys are configured.
- Deterministic guardrails as fallback and consistency checks.
- Hollow Score for low-proof, generic, or diff-restating content.
- Human Proof Score for trust/readiness.
- Claim Map showing whether extracted claims are supported, partial, or too vague.
- Reviewer Questions focused only on what matters next.
- Recommended Fix Plan with priority.
- PDF/TXT/MD upload for docs and resumes.
- Friendly validation toasts for bad input, unreadable PDFs, oversized files, and backend errors.
- CI Gate generator for GitHub Actions PR checks.
- JSON, CSV, Markdown, and PDF exports for repository scans.

## Screenshots

Add final screenshots before submission under:

```text
docs/screenshots/
```

Recommended files:

```text
docs/screenshots/track-a-repo-scan.png
docs/screenshots/track-a-manual-pr.png
docs/screenshots/track-b-docs-report.png
docs/screenshots/track-c-resume-upload.png
docs/screenshots/track-d-communications.png
docs/screenshots/ci-gate.png
```

Then embed them in this README with:

```md
![Track A Repo Scan](docs/screenshots/track-a-repo-scan.png)
```

## How The Detection Works

PRGuard uses a hybrid engine:

1. **Deterministic proof checks** inspect specific review signals: examples, metrics, tests, risk, rollback, owners, deadlines, snippets, and evidence density.
2. **Hollow Score** estimates how much the artifact looks polished but low-signal.
3. **Claim extraction** maps concrete claims against nearby proof signals.
4. **AI report generation** produces the user-facing explanation when AI keys are configured.
5. **Guardrail fallback** keeps the app usable and reviewable even when AI providers fail.

This is intentionally not a wrapper around GPTZero or a single prompt asking "is this AI?" The project scores the quality and proof of the artifact, not the morality of using AI.

## Evaluation

Run:

```bash
npm run evaluate
```

Current local baseline:

```text
Dataset examples: 240
Tracks: A/B/C/D, 60 examples each
Labels: clean/review/slop, 80 examples each
Accuracy: 0.88
False positive rate: 0.00
False negative rate: 0.00
```

Per-track accuracy:

```text
Code Review:     0.92
Docs & KBs:      0.87
Hiring/Resumes:  0.88
Communications:  0.87
```

PRGuard reports are review aids, not 100% accuracy guarantees. The UI shows a success/readiness estimate based on AI confidence plus guardrail checks.

## Hackathon Scoring Fit

| Slop Scan Criterion | How PRGuard Addresses It |
| --- | --- |
| Detection Accuracy - 30% | Evaluation dataset, confusion matrix, false positive/negative reporting, deterministic proof checks. |
| Practical Usefulness - 25% | Live repo scan, manual PR scan, docs/resume upload, comms scan, CI Gate, exports. |
| Technical Execution - 20% | Monorepo with reusable scoring package, Express API, Vite React UI, typed validation, deployment configs. |
| Innovation - 15% | Human Proof Score and Hollow Score focus on proof quality instead of only AI authorship. |
| Presentation & Demo - 10% | One-page UI, concise reports, reviewer questions, clear fix plans, demo-ready workflows. |

Bonus alignment:

- **Bake-Off +5:** local dataset and metrics are included.
- **Live Fire +5:** Track A can scan real GitHub pull requests.
- **Cross-Track Scanner +3:** one shared engine supports Tracks A-D.
- **Open Source Ready +3:** README, deploy config, CI Gate generator, and reproducible commands are included.

## Demo Script

Use this 2-3 minute flow for the submission video:

1. Open https://pqguard.vercel.app/.
2. Track A: scan `kubernetes/kubernetes` or another public repo and show ranked risky PRs.
3. Track A manual: paste one PR description and show the AI Proof Report.
4. Track B: paste or upload README/docs content and show missing examples or expected output.
5. Track C: upload a text-based resume PDF and show proof gaps around owned work or measurable results.
6. Track D: paste a vague status message and show missing ask, owner, deadline, and next action.
7. Open CI Gate and generate the GitHub Actions workflow.

## Quickstart

Use Node.js `22.13.0` or newer.

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

For Docker:

```bash
docker-compose up --build
```

## Commands

```bash
npm run dev       # run API and web app
npm run build     # build all workspaces
npm run lint      # lint all workspaces
npm run evaluate  # run local scoring evaluation
npm run check     # lint + build + evaluate
```

## Environment Variables

Copy `.env.example` to `.env` for local development.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | API port, defaults to `4100`. |
| `NODE_ENV` | No | Runtime mode. |
| `CORS_ORIGIN` | Production | Frontend origin allowed by API CORS. |
| `MONGODB_URI` | No | Optional MongoDB persistence for scans. |
| `GITHUB_TOKEN` | No | Higher GitHub rate limit and private repo access. |
| `PRGUARD_MAX_PRS` | No | Caps scanned PR count. |
| `PRGUARD_AI_ENABLED` | No | Enables optional AI report generation. |
| `PRGUARD_AI_TIMEOUT_MS` | No | AI provider timeout. |
| `PRGUARD_AI_SCAN_LIMIT` | No | Limits AI enrichment during repo scans. |
| `GEMINI_API_KEY` | No | Optional Gemini provider key. |
| `GEMINI_MODEL` | No | Gemini model name. |
| `GROQ_API_KEY` | No | Optional Groq provider key. |
| `GROQ_MODEL` | No | Groq model name. |
| `HUGGINGFACE_API_KEY` | No | Optional Hugging Face key. |
| `HUGGINGFACE_MODEL` | No | Hugging Face model name. |
| `OLLAMA_BASE_URL` | No | Optional local Ollama URL. |
| `OLLAMA_MODEL` | No | Ollama model name. |
| `VITE_API_BASE_URL` | Frontend | API base URL for the web app. |

Never commit real `.env` secrets.

## Deployment

### Render Backend

```text
Root Directory: leave blank
Build Command: npm ci --include=dev && npm --workspace @prguard/scoring run build && npm --workspace @prguard/api run build
Start Command: npm --workspace @prguard/api run start
Health Check Path: /api/health
```

Important Render environment values:

```text
NODE_VERSION=22.13.0
NODE_ENV=production
CORS_ORIGIN=https://pqguard.vercel.app
PRGUARD_AI_ENABLED=true
VITE_API_BASE_URL is not needed on Render
```

### Vercel Frontend

```text
Framework Preset: Vite
Build Command: npm --workspace @prguard/web run build
Output Directory: apps/web/dist
```

Important Vercel environment value:

```text
VITE_API_BASE_URL=https://pqguard.onrender.com/api
```

## API Routes

```text
GET  /api/health
GET  /api/health/db
POST /api/scan
POST /api/analyze
POST /api/proof/analyze
POST /api/ci-yaml
POST /api/report
```

## Architecture

```text
Vite React Web App
  |
  | REST API
  v
Express API
  |-- GitHub ingestion
  |-- AI provider orchestration
  |-- CI workflow generator
  |-- report exports
  v
@prguard/scoring
  |-- Hollow Score
  |-- Human Proof Score
  |-- Track guardrails
  |-- claim extraction
```

## Security And Privacy

- `.env` is ignored by Git.
- Inputs are validated with Zod.
- Request bodies are size-limited.
- GitHub tokens are accepted through env or scan form and are not stored in the frontend.
- Error responses redact sensitive token-like values.
- Exports mask common emails, phone numbers, profile URLs, bearer tokens, and GitHub-style tokens.
- Rendered report content is treated as text, not unsafe HTML.

## Known Limits

- PDF upload reads selectable text only. Scanned/image-only PDFs need OCR or pasted text.
- AI reports depend on configured provider availability and rate limits.
- The scoring engine is conservative: some clean content may be marked "Needs Review" if proof is thin.
- GitHub rate limits apply without a token.

## License

MIT
