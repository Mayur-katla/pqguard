export type AnalysisMode = "code_review" | "docs" | "hiring" | "communications";

export type ScoreBand = "Clean" | "Review" | "Flag" | "Block";

export interface ScoreComponent {
  name: string;
  score: number;
  weight: number;
  reason: string;
}

export interface HollowScore {
  score: number;
  band: ScoreBand;
  action: string;
  summary: string;
  components: ScoreComponent[];
  reasons: string[];
  evidence: Array<{ label: string; excerpt: string; severity: "low" | "medium" | "high" }>;
  highlightedPhrases: string[];
  metrics: Record<string, number>;
}

export interface ProofChecklistItem {
  label: string;
  passed: boolean;
  severity: "low" | "medium" | "high";
  detail: string;
}

export interface ClaimEvidence {
  claim: string;
  status: "supported" | "partial" | "unsupported" | "too_vague";
  evidence: string[];
  missing: string[];
}

export interface FixStep {
  title: string;
  detail: string;
  priority: "low" | "medium" | "high";
}

export interface ProofAnalysisResult {
  mode: AnalysisMode;
  hollowScore: HollowScore;
  proofScore: number;
  proofBand: "Strong" | "Partial" | "Weak" | "Missing";
  missingProof: ProofChecklistItem[];
  claims: ClaimEvidence[];
  questions: string[];
  fixPlan: FixStep[];
  summary: string;
}

export interface PullRequestScore {
  id: number;
  number: number;
  title: string;
  author: string;
  url: string;
  body: string;
  files: Array<{ filename: string; additions?: number; deletions?: number; patch?: string }>;
  commits: Array<{ sha?: string; message: string; author?: string; date?: string }>;
  comments: Array<{ body: string; author?: string; path?: string; date?: string }>;
  score: HollowScore;
  proof: ProofAnalysisResult;
}

export interface ScanResult {
  id: string;
  source: "github";
  repository: { owner: string; name: string; url: string; private?: boolean };
  createdAt: string;
  providerStatus: Record<string, boolean>;
  summary: {
    totalPrs: number;
    averageScore: number;
    clean: number;
    review: number;
    flag: number;
    block: number;
    topRisk: PullRequestScore[];
  };
  pullRequests: PullRequestScore[];
}
