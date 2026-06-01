# PRGuard

**Human Proof Scanner for Slop Scan 2026**

PRGuard finds content that looks complete but lacks proof that a human actually understood, reviewed, or owned it. It works across pull requests, docs, resumes, and workplace messages.

```text
PRGuard does not ask only: "Was this written by AI?"
It asks: "Is there enough human proof here to trust this?"
```
The question PRGuard asks is not "was this written by AI?"
It's "is there enough human proof here for me to act on this?"
```

---

## Live App

| | |
|---|---|
| App | https://pqguard.vercel.app/ |
| API | https://pqguard.onrender.com/api/health |
| Primary track | Track A — Code Review |
| Bonus tracks | B — Docs, C — Hiring, D — Communications |

---

## Why we built this

The dangerous kind of AI slop isn't the obviously wrong kind. It's the polished, confident, and completely empty kind:

- A PR description that restates the diff line by line but never explains *why* the change was made or what could go wrong.
- A README that sounds thorough but has no copy-paste command, no expected output, and no example you can actually follow.
- A resume bullet that claims "led a cross-functional initiative" with no project name, no team size, and no result you could verify.
- A Slack update that takes three paragraphs to say nothing was decided and nobody owns anything.

PRGuard turns those weak signals into a concrete list of what's missing, so reviewers can decide faster and authors can fix the right things.

---

## What it checks

| Track | What you give it | What PRGuard looks for |
|---|---|---|
| A — Code Review | GitHub repo URL or pasted PR text | Intent clarity, diff support, test evidence, rollback plan, risky file patterns, commit specificity, review signal |
| B — Docs & KBs | Pasted text or uploaded PDF/TXT/MD | Concrete steps, working examples, code snippets, expected output, circular wording |
| C — Hiring & Resumes | Pasted text or uploaded PDF/TXT/MD | Measurable outcomes, owned work, named tools and projects, unsupported impact claims |
| D — Communications | Pasted Slack/email/status text | Clear ask or decision, named owner, deadline or timing, next action, corporate filler density |

---

## What you get back

Every analysis returns the same set of outputs regardless of track:

**Hollow Score** — how polished-but-empty the content is. High score means it sounds good but says little.

**Human Proof Score** — how much concrete evidence exists that a real person understood and owned this. Low score means something important is missing before you should trust it.

**Proof gaps** — the specific things that are absent. Not "this lacks detail" — more like "no test name mentioned," "no rollback step," "no deadline set," "impact claim has no metric."

**Reviewer questions** — the three or four questions worth actually asking before approving, not a generic checklist.

**Claim map** — which statements in the content are supported, which are partially supported, and which float with nothing backing them up.

**Fix plan** — concrete suggestions for the author, prioritized by what matters most.

---

## How the detection works

PRGuard uses a hybrid engine rather than a single prompt asking an AI to judge AI output:

1. **Deterministic proof checks** look for specific signals: named tests, file references, metrics, deadlines, rollback steps, code examples, and evidence density. These run regardless of whether an AI provider is configured.
2. **Hollow Score** estimates how much the content uses surface-level polish to substitute for actual substance.
3. **Claim extraction** maps what the content *claims* against what it *shows*.
4. **AI report generation** produces the human-readable explanation when a provider key is available.
5. **Guardrail fallback** keeps everything reviewable and consistent even when AI providers are slow or unavailable.

This is not a wrapper around GPTZero. PRGuard does not try to identify AI authorship. It scores the quality of evidence in the artifact itself.

---

## Evaluation

```bash
npm run evaluate
```

Current results on 240 labeled examples (60 per track, labels: clean / review / slop):

```
Accuracy:            0.88
False positive rate: 0.00
False negative rate: 0.00

Per-track:
  Code Review:    0.92
  Docs & KBs:     0.87
  Hiring:         0.88
  Communications: 0.87
```

These are review-aid numbers on a synthetic dataset, not production accuracy guarantees. The evaluation script reports accuracy, false positive rate, false negative rate, a confusion matrix, per-track breakdown, and the full list of misclassified examples so you can see exactly where the engine disagrees with the labels.

---

## Live App

| | |
|---|---|
| App | https://pqguard.vercel.app/ |
| API | https://pqguard.onrender.com/api/health |
| Primary track | Track A - Code Review |
| Bonus tracks | Track B - Docs, Track C - Hiring, Track D - Communications |

## Why We Built It

The hardest slop to catch is polished and confident:

- A PR description that restates the diff but never explains risk.
- A README that sounds complete but has no runnable example.
- A resume that claims impact without proof of owned work.
- A status update that says a lot but decides nothing.

PRGuard turns those weak signals into proof gaps, reviewer questions, and a fix plan.

## Track Coverage

| Track | Input | What PRGuard Checks |
|---|---|---|
| A - Code Review | GitHub repo scan or pasted PR text | Intent, diff support, tests, rollback, risky files, commits, review signal |
| B - Docs & KBs | Pasted text or PDF/TXT/MD upload | Steps, examples, snippets, expected output, circular wording |
| C - Hiring & Resumes | Pasted text or PDF/TXT/MD upload | Owned work, metrics, tools, project evidence, unsupported claims |
| D - Communications | Pasted Slack/email/status text | Ask, decision, owner, deadline, next action, filler density |

## How We Created The Tracks

**Track A - Code Review**

Started with real GitHub PR data because this is the primary track. The scanner pulls PR titles, bodies, changed files, commits, and comments, then checks whether the PR has enough proof for review.

Main hurdle: early results included boilerplate from PR templates and ranked some low-risk PRs too highly. We fixed this by filtering template fragments, mapping claims to changed files, and enriching only the top-risk PRs with AI.

**Track B - Docs**

Built around the question: "Can a reader actually follow this?" The docs track looks for concrete commands, examples, expected output, snippets, and non-circular explanations.

Main hurdle: generic but harmless docs were getting scored too harshly. We calibrated the checks so useful README/resource-list content is not treated the same as empty documentation.

**Track C - Hiring**

Built for resumes, cover letters, portfolios, and take-home writeups. It checks whether claims are measurable, owned by the candidate, connected to tools/projects, and supported by evidence.

Main hurdle: PDF upload. Text-based PDFs worked, but scanned/image-only PDFs needed an AI extraction fallback. We added PDF text extraction, AI fallback for hard PDFs, and automatic analysis after upload.

**Track D - Communications**

Built for Slack, email, meeting notes, and status updates. The track checks whether the message has a clear ask or decision, owner, time, and next action.

Main hurdle: many workplace messages sound professional while saying nothing. We added checks for vague alignment language, missing ownership, and missing timing.

## What The Report Shows

- **Hollow Score:** how polished-but-empty the content looks.
- **Human Proof Score:** how much concrete evidence is present.
- **Proof gaps:** exactly what is missing.
- **Reviewer questions:** what a reviewer should ask next.
- **Claim map:** which claims are supported, partial, or too vague.
- **Fix plan:** the fastest way to improve the artifact.

## How Detection Works

PRGuard uses a hybrid engine:

1. Deterministic guardrails check for concrete proof signals.
2. Hollow Score estimates low-substance polish.
3. Claim extraction maps claims against nearby evidence.
4. AI generates the main readable report when available.
5. Guardrails remain as fallback and consistency checks.

This is not a GPTZero clone. PRGuard scores proof quality, not just authorship.

## Evaluation

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

## Quickstart

Node.js 22.13.0 or newer.

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

---

## Environment variables

Copy `.env.example` to `.env` for local development.

| Variable | Required | What it does |
|---|---|---|
| `PORT` | No | API port, defaults to 4100 |
| `NODE_ENV` | No | Runtime mode |
| `CORS_ORIGIN` | Production | Frontend origin for API CORS |
| `MONGODB_URI` | No | Optional persistence for scan history |
| `GITHUB_TOKEN` | No | Higher rate limits and private repo access |
| `PRGUARD_MAX_PRS` | No | Cap on how many PRs get scanned per repo |
| `PRGUARD_AI_ENABLED` | No | Turns on AI report generation |
| `PRGUARD_AI_TIMEOUT_MS` | No | Timeout for AI provider calls |
| `PRGUARD_AI_SCAN_LIMIT` | No | Limits AI enrichment during bulk repo scans |
| `GEMINI_API_KEY` | No | Gemini provider |
| `GEMINI_MODEL` | No | Gemini model name |
| `GROQ_API_KEY` | No | Groq provider |
| `GROQ_MODEL` | No | Groq model name |
| `HUGGINGFACE_API_KEY` | No | Hugging Face provider |
| `HUGGINGFACE_MODEL` | No | Hugging Face model name |
| `OLLAMA_BASE_URL` | No | Local Ollama instance |
| `OLLAMA_MODEL` | No | Ollama model name |
| `VITE_API_BASE_URL` | Frontend | API base URL for the web app |

None of the AI provider keys are required. The engine runs deterministically without them.

---

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
NODE_VERSION=22.13.0
NODE_ENV=production
CORS_ORIGIN=https://pqguard.vercel.app
PRGUARD_AI_ENABLED=true
```

### Frontend on Vercel

```
Framework Preset:  Vite
Build Command:     npm --workspace @prguard/web run build
Output Directory:  apps/web/dist
```

Vercel environment variable to set:

```
VITE_API_BASE_URL=https://pqguard.onrender.com/api
```

---

## API

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
Vite React app
  |
  v
Express API
  |-- GitHub ingestion
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

## Security And Privacy

- Inputs are validated with Zod.
- Request bodies are size-limited.
- GitHub tokens are not stored in the frontend.
- Error responses redact token-like values.
- Exports mask common emails, phone numbers, profile URLs, and bearer tokens.
- Report content is treated as plain text, not HTML.

## Known Limits

- PDF upload reads selectable text first, then can use AI extraction for harder PDFs when the provider is available.
- AI reports depend on provider availability and rate limits.
- Conservative scoring may mark thin but acceptable content as "Needs Review."
- GitHub rate limits apply without a token.

## Demo Script

1. Open https://pqguard.vercel.app/
2. Track A repo scan: scan an active public repo and show ranked risky PRs.
3. Track A manual: paste one PR description and show the proof report.
4. Track B: paste or upload docs and show missing examples/output.
5. Track C: upload a text-based resume PDF and show proof gaps.
6. Track D: paste a vague update and show missing owner/deadline/action.
7. Open CI Gate and generate the GitHub Actions workflow.

## Screenshots

Add final screenshots to:

```text
docs/screenshots/
```

Recommended:

```text
track-a-repo-scan.png
track-a-manual-pr.png
track-b-docs-report.png
track-c-resume-upload.png
track-d-communications.png
ci-gate.png
```

## License

MIT
