export function riskClass(score: number) {
  if (score >= 80) return "score-block";
  if (score >= 60) return "score-flag";
  if (score >= 40) return "score-review";
  return "score-clean";
}

export function proofRiskClass(proofScore: number) {
  return riskClass(100 - proofScore);
}
