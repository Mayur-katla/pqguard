# PRGuard Super Roadmap: Track A + B + C + D

Official alignment source: https://slopscan.dev/

PRGuard is positioned as a **Human Review Proof Scanner**.

Winning angle:

```text
PRGuard detects content that looks complete but lacks proof a human understood or verified it.
```

## Completion Status

Development status:

- [x] Track A - Code Review is implemented as the primary track.
- [x] Track B - Docs & KBs is implemented as a bonus mode.
- [x] Track C - Hiring & Resumes is implemented as a bonus mode.
- [x] Track D - Communications is implemented as a bonus mode.
- [x] One shared scoring engine powers all four tracks.
- [x] One-page responsive UI is implemented.
- [x] Live-only product flow is implemented. Demo data and Demo Mode routes are removed from the active app.
- [x] Local development checks pass.
- [ ] Deployment is not completed yet.
- [ ] Public repo, final video, screenshots, and submission form are not completed yet.

Verdict:

```text
Track A/B/C/D development is complete. Full hackathon submission is not complete until deployment, public repo readiness, final README polish, screenshots/video, and final form submission are done.
```

## Track Strategy

Primary track:

- [x] Track A - Code Review

Bonus tracks through one shared analyzer:

- [x] Track B - Docs & KBs
- [x] Track C - Hiring & Resumes
- [x] Track D - Communications

SlopScan positioning:

- [x] Primary track remains Code Review.
- [x] Cross-track bonus is supported through Docs, Hiring, and Communications.
- [x] The tool detects weak proof and missing verification, not just generic AI-likelihood.
- [x] The product gives useful next actions, not only labels or warnings.

## Product Goal

Build one simple app, not four separate tools.

User flow:

```text
Choose Mode -> Add Input -> Analyze -> View Proof Score -> Copy Questions/Fix Plan -> Export
```

Modes:

- [x] Code Review: GitHub PRs, commits, diffs, comments.
- [x] Docs: README, documentation, KB articles.
- [x] Hiring: resumes, cover letters, take-home explanations.
- [x] Communications: Slack messages, emails, meeting notes, status updates.

Unified outputs:

- [x] Hollow Score: how slop-like the content is.
- [x] Human Proof Score: how much evidence exists that a human understood or verified it.
- [x] Missing Proof Checklist.
- [x] Claim-to-Evidence Map.
- [x] Suggested Questions.
- [x] Fix Plan.
- [x] Exportable Report.

## Track Requirements

### Track A - Code Review

- [x] Scan public GitHub repos.
- [x] Support GitHub token for higher public API limits and private repo access.
- [x] Fetch PR titles, descriptions, diffs/files, commits, commit messages, issue comments, and review comments.
- [x] Score PR descriptions for information density vs diff-restating filler.
- [x] Detect hollow commit messages and repeated contribution patterns.
- [x] Flag review comments that add no meaningful review signal.
- [x] Add Review Proof Score for each PR.
- [x] Build Claim-to-Diff Evidence Map.
- [x] Generate reviewer questions.
- [x] Generate fix plan.
- [x] Generate CI gate YAML.

Track A proof checks:

- [x] Intent explained.
- [x] Diff supports claims.
- [x] Tests or verification present.
- [x] Risk or rollback noted.
- [x] Commit messages specific.
- [x] Review comments useful.
- [x] Security/auth/payment/config changes highlighted.

Track A implementation notes:

- [x] `POST /api/scan` scans live GitHub repositories.
- [x] GitHub token can come from request input or `GITHUB_TOKEN`.
- [x] PR files, commits, issue comments, and review comments are fetched.
- [x] Each PR receives `score` and `proof` objects.
- [x] CI YAML is generated through `POST /api/ci-yaml`.

### Track B - Docs & KBs

- [x] Accept pasted docs/README/KB text.
- [x] Detect missing examples.
- [x] Detect missing step-by-step instructions.
- [x] Detect missing code/config snippets.
- [x] Detect missing expected output.
- [x] Detect circular explanations.
- [x] Map documentation claims to concrete examples.
- [x] Generate reader verification questions.
- [x] Generate doc fix plan.

### Track C - Hiring & Resumes

- [x] Accept resume, cover letter, or take-home explanation text.
- [x] Detect unsupported impact claims.
- [x] Detect missing measurable outcomes.
- [x] Detect missing project/tool evidence.
- [x] Detect generic templated phrasing.
- [x] Generate recruiter verification questions.
- [x] Generate evidence-request fix plan.
- [x] Avoid accusing candidates of using AI.

Required wording:

```text
This application lacks verifiable evidence.
```

Status:

- [x] Product framing uses missing proof, unsupported evidence, and verification risk instead of accusing authors or candidates of AI use.

### Track D - Communications

- [x] Accept Slack message, email, meeting note, or status update.
- [x] Detect missing ask, owner, deadline, decision, or next action.
- [x] Score signal-to-noise ratio through Hollow Score and proof checklist signals.
- [x] Flag inflated corporate-speak.
- [x] Generate clarifying questions.
- [x] Generate action-focused fix plan.

## Unified Scoring Engine

Implemented result shape:

```ts
type AnalysisMode =
  | "code_review"
  | "docs"
  | "hiring"
  | "communications";

interface ProofAnalysisResult {
  mode: AnalysisMode;
  hollowScore: HollowScoreResult;
  proofScore: number;
  proofBand: "Strong" | "Partial" | "Weak" | "Missing";
  missingProof: ProofChecklistItem[];
  claims: ClaimEvidence[];
  questions: string[];
  fixPlan: FixStep[];
  summary: string;
}
```

Human Proof Score weights:

- [x] Specificity: 25%
- [x] Evidence coverage: 25%
- [x] Actionability: 20%
- [x] Context alignment: 20%
- [x] Verification/test/metric signal: 10%

Implementation files:

- [x] `packages/scoring/src/hollow.ts`
- [x] `packages/scoring/src/proof.ts`
- [x] `packages/scoring/src/types.ts`
- [x] `scripts/evaluate.mjs`

## UI/UX Plan

One-page app only.

Primary controls:

- [x] Mode switch: Code Review | Docs | Hiring | Comms.
- [x] Analyze.
- [x] Scan Repo.
- [x] Export.
- [x] CI Gate.
- [x] Copy Questions.
- [x] Copy Fix Plan.
- [x] Copy Score.
- [x] Demo button removed from active UI.

Modals:

- [x] PR Detail Modal.
- [x] Evidence Map Modal.
- [x] Fix Plan Modal.
- [x] CI Gate Modal.
- [x] Export Modal.
- [x] Analyze input is above the fold instead of hidden behind a modal.
- [x] Evaluation metrics are available through `npm run evaluate`, not yet exposed in an in-app modal.

UX acceptance:

- [x] A judge can choose a mode and run analysis in under 30 seconds.
- [x] No complex navigation.
- [x] No separate pages.
- [x] Every result gives an action, not only a warning.
- [x] Mobile layout remains usable through responsive Tailwind grids and stacked controls.
- [x] UI uses Tailwind configuration only for styling; old plain V2 CSS was removed.

## API Plan

- [x] `POST /api/proof/analyze`
- [x] `/api/analyze` calls proof engine.
- [x] `/api/scan` calls proof engine for every fetched PR.
- [x] `/api/report` includes proof score, questions, fix plan, and evidence map fields through scan data.
- [x] `/api/ci-yaml` generates CI gate YAML.
- [x] `/api/demo`, `/api/demo/cross-track`, and `/api/demo/persist` removed from active API for live-only product behavior.

Active API:

- [x] `GET /api/health`
- [x] `GET /api/health/db`
- [x] `POST /api/scan`
- [x] `POST /api/analyze`
- [x] `POST /api/proof/analyze`
- [x] `POST /api/ci-yaml`
- [x] `POST /api/report`

## Live Data Policy

- [x] No Demo Mode in active frontend.
- [x] No auto-loaded seeded scan.
- [x] No visible demo-data workflow.
- [x] GitHub scan path uses live GitHub API data.
- [x] Text analyzer requires real pasted input.
- [x] `/api/demo` returns `404` in current runtime.

## Evaluation Dataset

Current dataset:

- [x] 60 total examples.
- [x] 15 Code Review.
- [x] 15 Docs.
- [x] 15 Hiring.
- [x] 15 Communications.

Labels:

- [x] clean
- [x] review
- [x] slop

Current metrics:

- [x] Accuracy: 0.87.
- [x] False positive rate: 0.04.
- [x] False negative rate: 0.00.
- [x] Confusion matrix.
- [x] Per-track accuracy.

Per-track accuracy:

- [x] Code Review: 0.93.
- [x] Docs: 0.80.
- [x] Hiring: 0.87.
- [x] Communications: 0.87.

## Deadline Plan

Deadline:

```text
June 1, 2026 @ 10:00 UTC
```

### Build

- [x] Complete proof engine.
- [x] Complete A/B/C/D analyzer UI.
- [x] Complete report exports.
- [x] Complete evaluation dataset and metrics script.
- [x] Complete Tailwind-only frontend styling.
- [x] Remove active demo data and demo routes.

### Deploy

- [ ] Deploy frontend.
- [ ] Deploy backend.
- [ ] Configure MongoDB and API keys in hosted environment.
- [ ] Smoke test deployed app.
- [ ] Add live deployment URL to README.

### Submission

- [ ] Public GitHub repo.
- [ ] README with final detection approach and evaluation numbers.
- [ ] Screenshots/GIF.
- [ ] 2-3 minute demo video using live app.
- [ ] 5-minute live demo script using live app.
- [ ] AI usage disclosure.
- [ ] Final submission form.

## Test Plan

Automated/local checks:

- [x] `npm run test`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm run evaluate`
- [x] `docker compose config --quiet`
- [ ] Full `docker compose up --build` runtime test is blocked until Docker Desktop engine is running locally.

Manual/runtime checks completed locally:

- [x] Frontend served at `http://localhost:5173`.
- [x] API served at `http://localhost:4100`.
- [x] `GET /api/health` works.
- [x] `POST /api/proof/analyze` works with live pasted Communications text.
- [x] `POST /api/scan` works with `octocat/Hello-World` and returns live GitHub PRs.
- [x] `POST /api/ci-yaml` works.
- [x] `POST /api/report` works.
- [x] `/api/demo` returns `404`.

Manual UI acceptance:

- [x] Code Review mode is visible.
- [x] Docs mode is visible.
- [x] Hiring mode is visible.
- [x] Communications mode is visible.
- [x] Analyze button works with pasted text.
- [x] Scan Repo modal works with a real GitHub repo.
- [x] Evidence Map modal is implemented.
- [x] Fix Plan modal is implemented.
- [x] Copy Questions works.
- [x] Copy Fix Plan works.
- [x] Copy Score works.
- [x] Export includes proof fields.

## Definition of Done

Development done:

- [x] Track A is clearly primary.
- [x] Tracks B/C/D are meaningful bonus modes.
- [x] A judge can run the local app without setup confusion.
- [x] The app works on real GitHub data.
- [x] The app works on pasted docs, hiring, and communications text.
- [x] Human Proof Score is explainable.
- [x] Evaluation numbers are generated locally.
- [x] Live-only behavior is implemented.

Submission still remaining:

- [ ] Deployment URL is live.
- [ ] Public source repo is ready.
- [ ] README is updated with deployment URL and final screenshots.
- [ ] Demo video is recorded.
- [ ] Final submission form is submitted.

Final status:

```text
PRGuard development is complete for Tracks A, B, C, and D. The project is not yet 100% hackathon-submission complete because deployment and final submission assets remain.
```
