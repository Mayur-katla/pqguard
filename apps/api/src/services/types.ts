import type { HollowScoreResult, ProofAnalysisResult } from "@prguard/scoring";

export interface ScanPr {
  id: number;
  number: number;
  title: string;
  author: string;
  url: string;
  createdAt: string;
  body: string;
  files: Array<{ filename: string; additions?: number; deletions?: number; patch?: string }>;
  commits: Array<{ sha?: string; message: string; author?: string; date?: string }>;
  comments: Array<{ body: string; author?: string; path?: string; date?: string }>;
  score: HollowScoreResult;
  proof: ProofAnalysisResult;
}

export interface ScanResult {
  id: string;
  source: "github";
  repository: {
    owner: string;
    name: string;
    url: string;
    private?: boolean;
  };
  createdAt: string;
  providerStatus: Record<string, boolean>;
  summary: {
    totalPrs: number;
    averageScore: number;
    clean: number;
    review: number;
    flag: number;
    block: number;
    topRisk: ScanPr[];
  };
  pullRequests: ScanPr[];
}
