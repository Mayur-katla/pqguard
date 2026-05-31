export type {
  AnalysisMode,
  ArtifactInput,
  ClaimEvidence,
  DiffFileInput,
  Evidence,
  FixStep,
  HollowScoreResult,
  ProofAnalysisInput,
  ProofAnalysisResult,
  ProofBand,
  ProofChecklistItem,
  ScoreBand,
  ScoreComponent
} from "./types.js";
export { detectUniversalContext, scoreArtifact } from "./hollow.js";
export { analyzeProof, modeFromContext } from "./proof.js";
