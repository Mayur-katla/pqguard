import type { AnalysisMode, ProofAnalysisResult, ScanResult } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4100/api";

async function errorMessageFor(response: Response) {
  const body = await response.json().catch(() => ({ error: response.statusText }));
  const details = Array.isArray(body.details) ? body.details.filter(Boolean).join(", ") : "";
  const base = typeof body.error === "string" && body.error ? body.error : response.statusText || "Request failed";

  if (response.status === 400) return details ? `Please check the input: ${details}` : `Please check the input: ${base}`;
  if (response.status === 413) return "This input is too large. Shorten the content or upload a smaller text file.";
  if (response.status === 429) return "GitHub or the AI provider is rate-limiting this request. Add a token or try again later.";
  if (response.status >= 500) return "The PRGuard backend hit an error. Try again, or check the Render logs if it continues.";
  return details ? `${base}: ${details}` : base;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {})
      }
    });
  } catch {
    throw new Error("Could not reach the PRGuard backend. Check the deployment URL, CORS settings, or network connection.");
  }

  if (!response.ok) {
    throw new Error(await errorMessageFor(response));
  }

  return (await response.json()) as T;
}

export function scanRepo(repoUrl: string, token?: string) {
  return request<ScanResult>("/scan", {
    method: "POST",
    body: JSON.stringify({ repoUrl, token: token || undefined })
  });
}

export function analyzeProof(mode: AnalysisMode, text: string, title?: string) {
  return request<ProofAnalysisResult>("/proof/analyze", {
    method: "POST",
    body: JSON.stringify({ mode, text, title })
  });
}

export async function getCiYaml(threshold: number) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/ci-yaml`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threshold })
    });
  } catch {
    throw new Error("Could not reach the PRGuard backend. Check the deployment URL, CORS settings, or network connection.");
  }
  if (!response.ok) throw new Error(await errorMessageFor(response));
  return response.text();
}

export async function downloadReport(scan: ScanResult, format: "json" | "csv" | "md" | "pdf") {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scan, format })
    });
  } catch {
    throw new Error("Could not reach the PRGuard backend. Check the deployment URL, CORS settings, or network connection.");
  }
  if (!response.ok) throw new Error(await errorMessageFor(response));
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `prguard-${scan.repository.owner}-${scan.repository.name}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
