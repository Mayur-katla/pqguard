# PRGuard

**Human Proof Scanner for Slop Scan 2026**

PRGuard finds content that looks complete but lacks proof that a human actually understood, reviewed, or owned it. Paste a PR description, a README, a resume, or a Slack message — and PRGuard tells you exactly what's missing before you decide whether to trust it.

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

## Quickstart

Node.js 22.13.0 or newer.

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

With Docker:

```bash
docker-compose up --build
```

---

## Commands

```bash
npm run dev       # start API and web app together
npm run build     # build all workspaces
npm run lint      # lint all workspaces
npm run evaluate  # run the local scoring evaluation
npm run check     # lint + build + evaluate in one go
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

### Backend on Render

```
Root Directory:   (leave blank)
Build Command:    npm ci --include=dev && npm --workspace @prguard/scoring run build && npm --workspace @prguard/api run build
Start Command:    npm --workspace @prguard/api run start
Health Check:     /api/health
```

Render environment variables to set:

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

```
GET  /api/health
GET  /api/health/db
POST /api/scan
POST /api/analyze
POST /api/proof/analyze
POST /api/ci-yaml
POST /api/report
```

---

## Architecture

```
Vite React web app
  |
  | REST
  v
Express API
  |-- GitHub ingestion
  |-- AI provider orchestration
  |-- CI workflow generator
  |-- Report exports (JSON / CSV / Markdown / PDF)
  v
@prguard/scoring
  |-- Hollow Score
  |-- Human Proof Score
  |-- Track guardrails (A/B/C/D)
  |-- Claim extraction
```

---

## Security and privacy

- `.env` is gitignored.
- All inputs are validated with Zod.
- Request bodies are size-limited.
- GitHub tokens are accepted via environment variable or the scan form and are never stored in the frontend.
- Error responses redact token-like values.
- Exports mask emails, phone numbers, profile URLs, and bearer tokens.
- Report content is treated as plain text, not rendered as HTML.

---

## Known limits

- **PDF uploads** read selectable text only. Scanned or image-only PDFs need OCR or pasted text instead.
- **AI reports** depend on whichever provider key is configured and its availability. The deterministic engine always runs as a fallback.
- **Conservative scoring** — some genuinely clean content gets flagged as "Needs Review" when the proof signals are thin but the content is fine. The confusion matrix in `npm run evaluate` shows exactly where this happens.
- **GitHub rate limits** apply without a token. A token raises the limit significantly and is recommended for scanning active repos.

---

## Demo script

For the 2–3 minute submission video:

1. Open https://pqguard.vercel.app/
2. **Track A — repo scan:** enter `kubernetes/kubernetes` or another active public repo and show the ranked risky PR list.
3. **Track A — manual:** paste one PR description and walk through the AI proof report.
4. **Track B:** paste or upload a README and show what's flagged as missing.
5. **Track C:** upload a text resume PDF and show proof gaps around owned work and measurable results.
6. **Track D:** paste a vague status update and show the missing ask, owner, deadline, and next action.
7. Open the CI Gate and generate the GitHub Actions workflow.

---

## Screenshots

Add final screenshots before submission to `docs/screenshots/`:

```
docs/screenshots/track-a-repo-scan.png
docs/screenshots/track-a-manual-pr.png
docs/screenshots/track-b-docs-report.png
docs/screenshots/track-c-resume-upload.png
docs/screenshots/track-d-communications.png
docs/screenshots/ci-gate.png
```

---

## License

MIT
