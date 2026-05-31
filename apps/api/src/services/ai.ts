import type { ProofAnalysisInput, ProofAnalysisResult } from "@prguard/scoring";
import { config } from "../config.js";

export interface AiReview {
  enabled: boolean;
  status: "generated" | "unavailable" | "disabled";
  provider?: "gemini" | "groq" | "ollama";
  model?: string;
  summary?: string;
  confidence?: number;
  needsHumanReview?: boolean;
  strengths: string[];
  weaknesses: string[];
  issues: string[];
  recommendations: string[];
  rewrite?: string;
  raw?: string;
  error?: string;
}

type ProviderName = NonNullable<AiReview["provider"]>;

interface ProviderResult {
  provider: ProviderName;
  model: string;
  text: string;
}

interface AiJson {
  summary?: unknown;
  confidence?: unknown;
  needsHumanReview?: unknown;
  strengths?: unknown;
  weaknesses?: unknown;
  issues?: unknown;
  recommendations?: unknown;
  rewrite?: unknown;
}

const SYSTEM_PROMPT = [
  "You are PRGuard's AI review layer.",
  "Use the deterministic scores as evidence, but do not blindly repeat them.",
  "Find concrete proof gaps, unsupported claims, reviewer questions, merits, demerits, and practical next actions.",
  "Return strict JSON only with keys: summary, confidence, needsHumanReview, strengths, weaknesses, issues, recommendations, rewrite.",
  "Use arrays of short strings for strengths, weaknesses, issues, and recommendations."
].join(" ");

function truncate(value = "", max = 9000) {
  return value.length > max ? `${value.slice(0, max)}\n[truncated]` : value;
}

function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8);
}

function normalizeError(error: unknown) {
  const message = error instanceof Error ? error.message : "AI provider failed.";
  return message.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]").slice(0, 220);
}

function promptFor(input: ProofAnalysisInput, proof: ProofAnalysisResult) {
  const rewriteInstruction: Record<ProofAnalysisInput["mode"], string> = {
    code_review: "Rewrite the PR description so it names intent, changed areas, tests, risk, and rollback notes without inventing unsupported facts.",
    docs: "Rewrite the docs excerpt so it has concrete steps, an example, expected output, and missing config placeholders without inventing product behavior.",
    hiring: "Rewrite the hiring text so it is specific, evidence-backed, measurable where possible, and clear about owned work without inventing fake metrics.",
    communications: "Rewrite the message so it has a clear ask or decision, owner, deadline or timing, and next action without inventing commitments."
  };

  return [
    `Mode: ${input.mode}`,
    `Title: ${input.title ?? "Untitled"}`,
    `Text:\n${truncate(input.body ?? "")}`,
    input.diff ? `Diff:\n${truncate(input.diff, 4000)}` : "",
    input.files?.length ? `Files:\n${truncate(JSON.stringify(input.files.slice(0, 20)), 4000)}` : "",
    input.commits?.length ? `Commits:\n${truncate(JSON.stringify(input.commits.slice(0, 20)), 3000)}` : "",
    input.comments?.length ? `Comments:\n${truncate(JSON.stringify(input.comments.slice(0, 20)), 3000)}` : "",
    `Deterministic result:\n${JSON.stringify({
      hollowScore: proof.hollowScore.score,
      hollowBand: proof.hollowScore.band,
      proofScore: proof.proofScore,
      proofBand: proof.proofBand,
      failedChecks: proof.missingProof.filter((item) => !item.passed).map((item) => item.label),
      claims: proof.claims.map((claim) => ({ claim: claim.claim, status: claim.status, missing: claim.missing })),
      fixPlan: proof.fixPlan
    })}`,
    `Rewrite task: ${rewriteInstruction[input.mode]} If facts are missing, preserve placeholders like [add test name], [owner], [deadline], or [metric] instead of making them up.`
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = config.aiTimeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function extractJson(text: string): AiJson | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as AiJson;
  } catch {
    return null;
  }
}

function parseAiReview(result: ProviderResult): AiReview {
  const parsed = extractJson(result.text);
  if (!parsed) {
    return {
      enabled: true,
      status: "generated",
      provider: result.provider,
      model: result.model,
      summary: result.text.trim().slice(0, 420),
      strengths: [],
      weaknesses: [],
      issues: [],
      recommendations: [],
      raw: result.text
    };
  }

  return {
    enabled: true,
    status: "generated",
    provider: result.provider,
    model: result.model,
    summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 420) : undefined,
    confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : undefined,
    needsHumanReview: typeof parsed.needsHumanReview === "boolean" ? parsed.needsHumanReview : undefined,
    strengths: arrayOfStrings(parsed.strengths),
    weaknesses: arrayOfStrings(parsed.weaknesses),
    issues: arrayOfStrings(parsed.issues),
    recommendations: arrayOfStrings(parsed.recommendations),
    rewrite: typeof parsed.rewrite === "string" ? parsed.rewrite.trim().slice(0, 3000) : undefined,
    raw: result.text
  };
}

async function callGemini(prompt: string): Promise<ProviderResult> {
  const model = config.geminiModel;
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.geminiApiKey
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) throw new Error(`Gemini API ${response.status}: ${(await response.text()).slice(0, 180)}`);
  const body = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
  if (!text) throw new Error("Gemini returned an empty response.");
  return { provider: "gemini", model, text };
}

async function callGroq(prompt: string): Promise<ProviderResult> {
  const model = config.groqModel;
  const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.groqApiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!response.ok) throw new Error(`Groq API ${response.status}: ${(await response.text()).slice(0, 180)}`);
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq returned an empty response.");
  return { provider: "groq", model, text };
}

async function callOllama(prompt: string): Promise<ProviderResult> {
  const model = config.ollamaModel;
  const baseUrl = config.ollamaBaseUrl.replace(/\/$/, "");
  const response = await fetchWithTimeout(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      options: { temperature: 0.2 }
    })
  }, Math.min(config.aiTimeoutMs, 6000));

  if (!response.ok) throw new Error(`Ollama API ${response.status}: ${(await response.text()).slice(0, 180)}`);
  const body = (await response.json()) as { message?: { content?: string } };
  const text = body.message?.content?.trim();
  if (!text) throw new Error("Ollama returned an empty response.");
  return { provider: "ollama", model, text };
}

async function callFirstAvailableProvider(prompt: string): Promise<ProviderResult> {
  const attempts: Array<() => Promise<ProviderResult>> = [];
  if (config.geminiApiKey) attempts.push(() => callGemini(prompt));
  if (config.groqApiKey) attempts.push(() => callGroq(prompt));
  if (config.ollamaBaseUrl && config.ollamaModel) attempts.push(() => callOllama(prompt));

  let lastError: unknown = new Error("No AI provider is configured.");
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function buildAiReview(input: ProofAnalysisInput, proof: ProofAnalysisResult): Promise<AiReview> {
  if (!config.aiEnabled) {
    return { enabled: false, status: "disabled", strengths: [], weaknesses: [], issues: [], recommendations: [] };
  }

  if (!config.geminiApiKey && !config.groqApiKey && !config.ollamaBaseUrl) {
    return {
      enabled: true,
      status: "unavailable",
      strengths: [],
      weaknesses: [],
      issues: [],
      recommendations: [],
      error: "No AI provider is configured."
    };
  }

  try {
    return parseAiReview(await callFirstAvailableProvider(promptFor(input, proof)));
  } catch (error) {
    return {
      enabled: true,
      status: "unavailable",
      strengths: [],
      weaknesses: [],
      issues: [],
      recommendations: [],
      error: normalizeError(error)
    };
  }
}

export async function enrichProofAnalysis<T extends ProofAnalysisResult>(proof: T, input: ProofAnalysisInput): Promise<T & { aiReview: AiReview }> {
  return {
    ...proof,
    aiReview: await buildAiReview(input, proof)
  };
}
