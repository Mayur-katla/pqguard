import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  join(process.cwd(), ".env"),
  join(here, "../../../.env"),
  join(here, "../../../../.env")
];
const envPath = envCandidates.find((candidate) => existsSync(candidate));
dotenv.config(envPath ? { path: envPath } : undefined);

export const config = {
  port: Number(process.env.PORT ?? 4100),
  nodeEnv: process.env.NODE_ENV ?? "development",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  mongodbUri: process.env.MONGODB_URI ?? "",
  githubToken: process.env.GITHUB_TOKEN ?? "",
  maxPullRequests: Number(process.env.PRGUARD_MAX_PRS ?? 0),
  aiEnabled: process.env.PRGUARD_AI_ENABLED !== "false",
  aiTimeoutMs: Number(process.env.PRGUARD_AI_TIMEOUT_MS ?? 12000),
  aiScanLimit: Number(process.env.PRGUARD_AI_SCAN_LIMIT ?? 3),
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqModel: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
  huggingFaceApiKey: process.env.HUGGINGFACE_API_KEY ?? "",
  huggingFaceModel: process.env.HUGGINGFACE_MODEL ?? "roberta-base-openai-detector",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL ?? "mistral"
};

export function providerStatus() {
  return {
    github: Boolean(config.githubToken),
    gemini: Boolean(config.geminiApiKey),
    groq: Boolean(config.groqApiKey),
    huggingFace: Boolean(config.huggingFaceApiKey),
    ollama: Boolean(config.ollamaBaseUrl),
    heuristics: true
  };
}
