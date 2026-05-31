# Architecture

PRGuard uses a small monorepo:

- `apps/web`: React/Vite one-page application.
- `apps/api`: Express API for scans, analysis, reports, and CI workflow generation.
- `packages/scoring`: Hollow Score, Human Proof Score, claim mapping, questions, and fix plan logic.

Data flow:

1. The user submits a GitHub repository or pastes a live text artifact.
2. The API fetches PRs, commits, files, and comments from GitHub.
3. The scoring package computes a Hollow Score and Human Proof Score for each PR or text artifact.
4. The API returns missing proof, claim evidence, verifier questions, and fix steps.
5. The web app presents heatmap, ranked PRs, modals, proof cards, exports, analytics, and CI YAML.

The scoring package works without external AI APIs. Optional provider keys can be added later to enrich the AI-likelihood signal.
