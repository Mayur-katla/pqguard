import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { z } from "zod";
import { analyzeProof, detectUniversalContext, modeFromContext, scoreArtifact } from "@prguard/scoring";
import { config, providerStatus } from "./config.js";
import { checkDb, saveScan } from "./db.js";
import { generateGithubActionYaml } from "./services/ci.js";
import { RepoUrlError, scanGitHubRepository } from "./services/github.js";
import { toCsv, toMarkdown, toPdf } from "./services/reports.js";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "PRGuard API", providerStatus: providerStatus() });
});

app.get("/api/health/db", async (_req, res, next) => {
  try {
    res.json(await checkDb());
  } catch (error) {
    next(error);
  }
});

const scanSchema = z.object({
  repoUrl: z.string().min(3).max(300),
  token: z.string().max(300).optional()
});

app.post("/api/scan", async (req, res, next) => {
  try {
    const input = scanSchema.parse(req.body);
    const scan = await scanGitHubRepository(input.repoUrl, input.token);
    await saveScan(scan).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "unknown persistence error";
      console.warn(`Scan persistence skipped: ${message}`);
    });
    res.json(scan);
  } catch (error) {
    next(error);
  }
});

const analyzeSchema = z.object({
  text: z.string().min(1).max(15000),
  title: z.string().max(250).optional(),
  mode: z.enum(["code_review", "docs", "hiring", "communications"]).optional()
});

app.post("/api/analyze", (req, res, next) => {
  try {
    const input = analyzeSchema.parse(req.body);
    const context = detectUniversalContext(input.text);
    const mode = input.mode ?? modeFromContext(context);
    const score = scoreArtifact({
      kind: context === "Code review" ? "pull_request" : "universal_text",
      title: input.title ?? context,
      body: input.text
    });
    const proof = analyzeProof({
      mode,
      kind: mode === "code_review" ? "pull_request" : "universal_text",
      title: input.title ?? context,
      body: input.text
    });
    res.json({ context, mode, score, proof });
  } catch (error) {
    next(error);
  }
});

const proofSchema = z.object({
  mode: z.enum(["code_review", "docs", "hiring", "communications"]),
  title: z.string().max(250).optional(),
  text: z.string().min(1).max(15000),
  diff: z.string().max(30000).optional(),
  files: z.array(z.object({ filename: z.string(), patch: z.string().optional(), additions: z.number().optional(), deletions: z.number().optional() })).optional(),
  commits: z.array(z.object({ message: z.string(), author: z.string().optional(), sha: z.string().optional(), date: z.string().optional() })).optional(),
  comments: z.array(z.object({ body: z.string(), author: z.string().optional(), path: z.string().optional(), date: z.string().optional() })).optional()
});

app.post("/api/proof/analyze", (req, res, next) => {
  try {
    const input = proofSchema.parse(req.body);
    res.json(
      analyzeProof({
        mode: input.mode,
        kind: input.mode === "code_review" ? "pull_request" : "universal_text",
        title: input.title,
        body: input.text,
        diff: input.diff,
        files: input.files,
        commits: input.commits,
        comments: input.comments
      })
    );
  } catch (error) {
    next(error);
  }
});

const ciSchema = z.object({
  threshold: z.number().int().min(1).max(100).default(70),
  apiBaseUrl: z.string().max(200).optional()
});

app.post("/api/ci-yaml", (req, res, next) => {
  try {
    const input = ciSchema.parse(req.body);
    res.type("text/yaml").send(generateGithubActionYaml(input.threshold, input.apiBaseUrl));
  } catch (error) {
    next(error);
  }
});

const reportSchema = z.object({
  format: z.enum(["json", "csv", "md", "pdf"]),
  scan: z.any()
});

app.post("/api/report", async (req, res, next) => {
  try {
    const input = reportSchema.parse(req.body);
    if (input.format === "json") return res.json(input.scan);
    if (input.format === "csv") return res.type("text/csv").send(toCsv(input.scan));
    if (input.format === "md") return res.type("text/markdown").send(toMarkdown(input.scan));
    const pdf = await toPdf(input.scan);
    return res.type("application/pdf").send(pdf);
  } catch (error) {
    return next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Validation failed", details: error.issues.map((issue) => issue.message) });
  }
  if (error instanceof RepoUrlError) {
    return res.status(400).json({ error: error.message });
  }
  const message = error instanceof Error ? error.message.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]") : "Unexpected error";
  return res.status(500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`PRGuard API listening on http://localhost:${config.port}`);
});
