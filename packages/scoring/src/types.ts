export type ArtifactKind = "pull_request" | "commit" | "review_comment" | "universal_text";

export type ScoreBand = "Clean" | "Review" | "Flag" | "Block";

export type AnalysisMode = "code_review" | "docs" | "hiring" | "communications";

export type ProofBand = "Strong" | "Partial" | "Weak" | "Missing";

export type ProofVerdict = "strong_proof" | "needs_review" | "high_risk" | "blocker" | "mostly_clear_needs_timing";

export interface DiffFileInput {
  filename: string;
  patch?: string;
  additions?: number;
  deletions?: number;
}

export interface ArtifactInput {
  kind: ArtifactKind;
  title?: string;
  body?: string;
  diff?: string;
  files?: DiffFileInput[];
  commits?: Array<{ message: string; author?: string; sha?: string; date?: string }>;
  comments?: Array<{ body: string; author?: string; path?: string; date?: string }>;
  metadata?: Record<string, unknown>;
}

export interface ScoreComponent {
  name: string;
  score: number;
  weight: number;
  reason: string;
}

export interface Evidence {
  label: string;
  excerpt: string;
  severity: "low" | "medium" | "high";
}

export interface HollowScoreResult {
  score: number;
  band: ScoreBand;
  action: string;
  summary: string;
  components: ScoreComponent[];
  reasons: string[];
  evidence: Evidence[];
  highlightedPhrases: string[];
  metrics: {
    wordCount: number;
    density: number;
    fillerRatio: number;
    diffAlignment: number;
    styleUniformity: number;
    commitSimilarity: number;
  };
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

export interface ProofAnalysisInput extends ArtifactInput {
  mode: AnalysisMode;
}

export interface ProofAnalysisResult {
  mode: AnalysisMode;
  hollowScore: HollowScoreResult;
  proofScore: number;
  proofBand: ProofBand;
  verdict: ProofVerdict;
  verdictLabel: string;
  verdictReason: string;
  nextAction: string;
  missingProof: ProofChecklistItem[];
  claims: ClaimEvidence[];
  questions: string[];
  fixPlan: FixStep[];
  summary: string;
}
