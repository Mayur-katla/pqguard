import type { AnalysisMode, ProofAnalysisResult, ScanResult } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4100/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    const details = Array.isArray(body.details) ? `: ${body.details.join(", ")}` : "";
    throw new Error(`${body.error ?? "Request failed"}${details}`);
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
  const response = await fetch(`${API_BASE}/ci-yaml`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threshold })
  });
  if (!response.ok) throw new Error("Could not generate CI workflow.");
  return response.text();
}

export async function downloadReport(scan: ScanResult, format: "json" | "csv" | "md" | "pdf") {
  const response = await fetch(`${API_BASE}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scan, format })
  });
  if (!response.ok) throw new Error("Could not export report.");
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
