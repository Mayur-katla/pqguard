import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { z } from "zod";
import { analyzeProof, detectUniversalContext, modeFromContext, scoreArtifact } from "@prguard/scoring";
import { config, providerStatus } from "./config.js";
import { checkDb, saveScan } from "./db.js";
import { enrichProofAnalysis, extractPdfTextWithGemini } from "./services/ai.js";
import { generateGithubActionYaml } from "./services/ci.js";
import { RepoUrlError, scanGitHubRepository } from "./services/github.js";
import { sanitizeScanReport, toCsv, toMarkdown, toPdf } from "./services/reports.js";

const app = express();
const MAX_ARTIFACT_TEXT_CHARS = 60_000;
const allowedCorsOrigins = new Set([
  "http://localhost:5173",
  "https://pqguard.vercel.app",
  ...config.corsOrigin.split(",").map((origin) => origin.trim()).filter(Boolean)
]);
const allowAllCorsOrigins = allowedCorsOrigins.has("*");

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowAllCorsOrigins || allowedCorsOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  }
}));
app.use(express.json({ limit: "8mb" }));
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
  text: z.string().min(1).max(MAX_ARTIFACT_TEXT_CHARS, `Text must be ${MAX_ARTIFACT_TEXT_CHARS.toLocaleString()} characters or fewer.`),
  title: z.string().max(250).optional(),
  mode: z.enum(["code_review", "docs", "hiring", "communications"]).optional()
});

app.post("/api/analyze", async (req, res, next) => {
  try {
    const input = analyzeSchema.parse(req.body);
    const context = detectUniversalContext(input.text);
    const mode = input.mode ?? modeFromContext(context);
    const score = scoreArtifact({
      kind: context === "Code review" ? "pull_request" : "universal_text",
      title: input.title ?? context,
      body: input.text
    });
    const proofInput = {
      mode,
      kind: mode === "code_review" ? "pull_request" : "universal_text",
      title: input.title ?? context,
      body: input.text
    } as const;
    const proof = await enrichProofAnalysis(analyzeProof(proofInput), proofInput);
    res.json({ context, mode, score, proof });
  } catch (error) {
    next(error);
  }
});

const proofSchema = z.object({
  mode: z.enum(["code_review", "docs", "hiring", "communications"]),
  title: z.string().max(250).optional(),
  text: z.string().min(1).max(MAX_ARTIFACT_TEXT_CHARS, `Text must be ${MAX_ARTIFACT_TEXT_CHARS.toLocaleString()} characters or fewer.`),
  diff: z.string().max(30000).optional(),
  files: z.array(z.object({ filename: z.string(), patch: z.string().optional(), additions: z.number().optional(), deletions: z.number().optional() })).optional(),
  commits: z.array(z.object({ message: z.string(), author: z.string().optional(), sha: z.string().optional(), date: z.string().optional() })).optional(),
  comments: z.array(z.object({ body: z.string(), author: z.string().optional(), path: z.string().optional(), date: z.string().optional() })).optional()
});

app.post("/api/proof/analyze", async (req, res, next) => {
  try {
    const input = proofSchema.parse(req.body);
    const proofInput = {
      mode: input.mode,
      kind: input.mode === "code_review" ? "pull_request" : "universal_text",
      title: input.title,
      body: input.text,
      diff: input.diff,
      files: input.files,
      commits: input.commits,
      comments: input.comments
    } as const;
    res.json(await enrichProofAnalysis(analyzeProof(proofInput), proofInput));
  } catch (error) {
    next(error);
  }
});

const pdfExtractSchema = z.object({
  fileName: z.string().max(180).optional(),
  mimeType: z.literal("application/pdf").default("application/pdf"),
  data: z.string().min(20).max(7_000_000),
  mode: z.enum(["docs", "hiring"]).optional()
});

app.post("/api/files/extract-pdf", async (req, res, next) => {
  try {
    const input = pdfExtractSchema.parse(req.body);
    const bytes = Buffer.from(input.data, "base64");
    if (bytes.length > 5_000_000) {
      return res.status(413).json({
        error: "PDF is too large",
        details: ["Upload a PDF under 5 MB."]
      });
    }

    const result = await extractPdfTextWithGemini({
      base64: input.data,
      mimeType: input.mimeType,
      fileName: input.fileName,
      mode: input.mode
    });
    if (result.text.length > MAX_ARTIFACT_TEXT_CHARS) {
      return res.status(413).json({
        error: "Extracted text is too large",
        details: [`Keep extracted text under ${MAX_ARTIFACT_TEXT_CHARS.toLocaleString()} characters.`]
      });
    }

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/429|quota|rate/i.test(message)) {
      return res.status(429).json({
        error: "AI PDF extraction is rate-limited",
        details: ["Try again later, upload a text-based PDF, or paste the resume text directly."]
      });
    }
    if (/API key|not configured|403|401/i.test(message)) {
      return res.status(400).json({
        error: "AI PDF extraction is not available",
        details: ["Configure a valid Gemini key, upload a text-based PDF, or paste the content directly."]
      });
    }
    return next(error);
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
    if (input.format === "json") return res.json(sanitizeScanReport(input.scan));
    if (input.format === "csv") return res.type("text/csv").send(toCsv(input.scan));
    if (input.format === "md") return res.type("text/markdown").send(toMarkdown(input.scan));
    const pdf = await toPdf(input.scan);
    return res.type("application/pdf").send(pdf);
  } catch (error) {
    return next(error);
  }
});

type HttpBodyError = Error & {
  status?: number;
  statusCode?: number;
  type?: string;
};

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const bodyError = error as HttpBodyError;
  if (bodyError?.type === "entity.too.large" || bodyError?.status === 413 || bodyError?.statusCode === 413) {
    return res.status(413).json({
      error: "Input is too large",
      details: ["Keep pasted or uploaded content under 60,000 characters."]
    });
  }
  if (bodyError instanceof SyntaxError && "body" in bodyError) {
    return res.status(400).json({
      error: "Invalid JSON request",
      details: ["Refresh the page and try again. If this repeats, paste plain text instead of formatted content."]
    });
  }
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
