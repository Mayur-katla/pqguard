# PRGuard

Human Proof Scanner for GitHub code review, docs, hiring, and workplace communication.

PRGuard scans pull requests, commit messages, diffs, review comments, docs, hiring materials, and workplace messages to detect content that sounds complete but lacks proof a human understood or verified it. It is built for SlopScan Track A as the primary track, with Tracks B/C/D covered through one shared Human Proof engine.

Winning angle:

```text
PRGuard detects content that looks complete but lacks proof a human understood or verified it.
```

## Quickstart

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

For the full Docker path:

```bash
docker-compose up --build
```

## Features

- One-page responsive dashboard with modal-driven workflows.
- Public GitHub repository scanning.
- Optional private repository scanning with a GitHub token.
- Hollow Score for PR descriptions, commits, diffs, and review comments.
- Explainable score components: AI-likelihood, information density, diff alignment gap, and style uniformity.
- Heatmap, score trend, ranked evidence queue, and PR detail drill-down.
- UniversalAnalyzer for pasted text across docs, resumes, team messages, and code review artifacts.
- Human Proof Score for Code Review, Docs, Hiring, and Communications.
- Verdict, reason, next action, Proof Gaps checklist, Claim-to-Evidence Map, reviewer questions, and fix plan.
- Optional proof review summary with Evidence Found, Proof Gaps, Recommended Fixes, and Safer Rewrite.
- Above-the-fold text analyzer for Track A/B/C/D live input.
- Shareable score card copy action.
- GitHub Actions YAML generator for merge gating.
- Privacy-safe JSON, CSV, Markdown, and PDF exports with verdicts, proof gaps, fixes, and reviewer questions.
- Live-only UI flow: scan a real GitHub repository or paste real content.

## Environment Variables

Copy `.env.example` to `.env` when running outside Docker or when adding real integrations.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | API port. Defaults to `4100`. |
| `NODE_ENV` | No | Runtime mode. |
| `CORS_ORIGIN` | No | Frontend origin allowed by the API. |
| `MONGODB_URI` | No | MongoDB connection for persisted scan history. |
| `GITHUB_TOKEN` | No | Raises GitHub rate limit and enables private repo access. |
| `PRGUARD_MAX_PRS` | No | Caps PRs scanned per repository. Defaults to `6` without GitHub token and `20` with token. |
| `GEMINI_API_KEY` | No | Optional AI provider key. |
| `GEMINI_MODEL` | No | Gemini model name. |
| `GROQ_API_KEY` | No | Optional Groq provider key. |
| `GROQ_MODEL` | No | Groq model name. |
| `HUGGINGFACE_API_KEY` | No | Optional Hugging Face provider key. |
| `HUGGINGFACE_MODEL` | No | Hugging Face model name. |
| `OLLAMA_BASE_URL` | No | Optional local Ollama server URL. |
| `OLLAMA_MODEL` | No | Ollama model name. |
| `VITE_API_BASE_URL` | No | Frontend API base URL. |

The deterministic heuristics engine is always available, so the app can run without AI keys.

## Architecture

```text
Browser
  |
  | Vite React one-page app
  v
Express API
  |-- GitHub ingestion
  |-- Hollow Score service
  |-- Human Proof service
  |-- UniversalAnalyzer
  |-- CI YAML generator
  |-- Report exporter
  v
MongoDB, optional for scan persistence
```

The scoring package is isolated in `packages/scoring` so it can be tested independently and reused by API routes.

## Development Commands

```bash
npm run dev       # web + API
npm run build     # all workspaces
npm run test      # scoring and API tests
npm run lint      # lint all workspaces
npm run evaluate  # local evaluation metrics
```

## API

- `GET /api/health`
- `GET /api/health/db`
- `POST /api/scan`
- `POST /api/analyze`
- `POST /api/proof/analyze`
- `POST /api/ci-yaml`
- `POST /api/report`

## Track Coverage

| Track | Mode | What PRGuard checks |
| --- | --- | --- |
| A - Code Review | Code Review | PR descriptions, diffs, commits, review comments, tests, risk notes. |
| B - Docs & KBs | Docs | Examples, steps, snippets, expected output, circular explanations. |
| C - Hiring & Resumes | Hiring | Measurable outcomes, project/tool evidence, generic unsupported claims. |
| D - Communications | Comms | Clear ask, owner, deadline, decision, next action, inflated filler. |

## Evaluation

Run:

```bash
npm run evaluate
```

The current evaluation dataset lives in `docs/evaluation-dataset.json` and reports accuracy, false positive rate, false negative rate, confusion matrix, and per-track accuracy.

Current local baseline:

```text
Examples: 240
Accuracy: 0.88
False positive rate: 0.00
False negative rate: 0.00
```

## Security and Privacy

- GitHub tokens are accepted only through environment variables or the scan form and are not stored by the frontend.
- Backend error messages redact bearer tokens.
- Generated reviews, copy actions, and exports mask emails, phone numbers, GitHub/LinkedIn profile URLs, bearer tokens, and GitHub-style tokens by default.
- Request bodies are size-limited.
- Inputs are validated with Zod.
- Rendered content is treated as text, not unsafe HTML.
- The active product does not expose seeded demo data.

For private repositories, teams should review their data retention policy before enabling MongoDB persistence.

## AI Usage Disclosure

PRGuard uses deterministic heuristics as its baseline and adds an optional AI review layer when provider keys are configured. The API currently tries Gemini first, then Groq, then Ollama, and returns provider/model metadata with each AI review. If every provider is unavailable, the deterministic analysis still works.

## License

MIT
