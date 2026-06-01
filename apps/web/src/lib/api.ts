import type { AnalysisMode, ProofAnalysisResult, ScanResult } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4100/api";

async function errorMessageFor(response: Response) {
  const body = await response.json().catch(() => ({ error: response.statusText }));
  const details = Array.isArray(body.details) ? body.details.filter(Boolean).join(", ") : "";
  const base = typeof body.error === "string" && body.error ? body.error : response.statusText || "Request failed";

  if (response.status === 400) return details ? `Please check the input: ${details}` : `Please check the input: ${base}`;
  if (response.status === 413) return "This input is too large. Shorten the content or upload a smaller text file.";
  if (response.status === 429) return details || "The AI provider is rate-limiting this request. Try again later, upload a text-based PDF, or paste the content directly.";
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

function base64FromFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read this PDF file."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

export async function extractPdfWithAi(file: File, mode: AnalysisMode) {
  const data = await base64FromFile(file);
  return request<{ text: string; provider: string; model: string; notes: string[] }>("/files/extract-pdf", {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      mimeType: "application/pdf",
      data,
      mode: mode === "hiring" || mode === "docs" ? mode : undefined
    })
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
