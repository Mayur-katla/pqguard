import { scoreArtifact } from "./hollow.js";
import type { AnalysisMode, ClaimEvidence, FixStep, ProofAnalysisInput, ProofAnalysisResult, ProofBand, ProofChecklistItem, ProofVerdict } from "./types.js";
import { clamp, cosineLikeSimilarity, sentences, uniqueMeaningfulWords, words } from "./utils.js";

const MODE_LABELS: Record<AnalysisMode, string> = {
  code_review: "Code Review",
  docs: "Docs & KBs",
  hiring: "Hiring & Resumes",
  communications: "Communications"
};

const MODE_FILLERS: Record<AnalysisMode, string[]> = {
  code_review: ["improves quality", "various fixes", "best practices", "cleanup", "refactor", "enhance"],
  docs: ["comprehensive guide", "easy to use", "seamless", "robust", "as needed", "simply"],
  hiring: ["results-driven", "passionate", "team player", "proven track record", "dynamic", "hard-working"],
  communications: ["align", "circle back", "synergy", "leverage", "streamline", "touch base", "moving forward"]
};

const CLAIM_PATTERNS = [
  /\b(improves?|enhances?|optimizes?|secures?|fixes?|adds?|removes?|reduces?|increases?|decreases?|supports?|handles?|prevents?)\b/i,
  /\b(led|owned|delivered|managed|built|created|designed|implemented|achieved)\b/i,
  /\b(will|should|can|must|need to|decided|approved|blocked)\b/i
];

function combinedText(input: ProofAnalysisInput) {
  const commits = input.commits?.map((commit) => commit.message).join("\n") ?? "";
  const comments = input.comments?.map((comment) => comment.body).join("\n") ?? "";
  return [input.title, input.body, commits, comments].filter(Boolean).join("\n\n");
}

function claimText(input: ProofAnalysisInput) {
  if (input.mode !== "code_review") return combinedText(input);

  const templatePatterns = [
    /add one of the following kinds/i,
    /optionally add one or more/i,
    /add the word ["']?fixes/i,
    /do not use ["']?fixes/i,
    /fixes\s+#<|fixes\s+none/i,
    /which issue|what type of pr|does this pr introduce/i,
    /user-facing change|documentation update|release note/i,
    /release note/i,
    /sig-|kind\/|area\/|priority\//i,
    /<!--|-->/,
    /^\s*[-*]\s*\[[ x]\]/i,
    /^\s*\/(?:kind|sig|area|priority|assign|cc)\b/i
  ];

  const cleanedBody = (input.body ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 8)
    .filter((line) => !templatePatterns.some((pattern) => pattern.test(line)))
    .join("\n");
  const commits = input.commits?.map((commit) => commit.message.split(/\r?\n/)[0]).join("\n") ?? "";
  return [input.title, cleanedBody, commits].filter(Boolean).join("\n\n");
}

function diffText(input: ProofAnalysisInput) {
  return [input.diff, input.files?.map((file) => `${file.filename}\n${file.patch ?? ""}`).join("\n")].filter(Boolean).join("\n");
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.filter((pattern) => pattern.test(text)).length;
}

function checklistItem(label: string, passed: boolean, severity: ProofChecklistItem["severity"], detail: string): ProofChecklistItem {
  return { label, passed, severity, detail };
}

function docsProfile(lower: string) {
  const hasInstall = hasAny(lower, [/npm install|npm i|pnpm add|yarn add|pip install|go get|cargo add|installation|install/]);
  const hasUsage = hasAny(lower, [/usage|quick start|quickstart|getting started|example|api|import |from ["']|require\(|function|hook|component/]);
  const hasCode = /```|npm |pnpm |yarn |curl |json|yaml|\.env|config|api|import |require\(/.test(lower);
  const hasExpectedOutput = hasAny(lower, [/expected|output|you should see|returns|response|result|prints|renders|displays/]);
  const hasTroubleshooting = hasAny(lower, [/troubleshoot|error|faq|common issue|debug|if .* fails|problem|known issue/]);
  const hasDeployment = hasAny(lower, [/deploy|render|vercel|docker|production|environment variable|\.env|hosting|server/]);
  const linkCount = (lower.match(/https?:\/\/|github\.com|\]\(/g) ?? []).length;
  const headingCount = (lower.match(/^#{1,4}\s+/gm) ?? []).length;
  const listItemCount = (lower.match(/^\s*[-*]\s+/gm) ?? []).length;
  const isResourceList = linkCount >= 6 && listItemCount >= 6 && headingCount >= 3 && !hasInstall;
  const isLibraryReadme = hasInstall && hasUsage && hasCode;
  const isRunbook = hasDeployment && hasInstall;

  return { hasInstall, hasUsage, hasCode, hasExpectedOutput, hasTroubleshooting, hasDeployment, headingCount, linkCount, listItemCount, isResourceList, isLibraryReadme, isRunbook };
}

function proofBand(score: number): ProofBand {
  if (score >= 75) return "Strong";
  if (score >= 50) return "Partial";
  if (score >= 25) return "Weak";
  return "Missing";
}

function cleanClaim(claim: string) {
  return claim
    .replace(/\s+/g, " ")
    .replace(/^[-*]\s*/, "")
    .replace(/^#+\s*/, "")
    .trim();
}

function extractClaims(text: string) {
  return sentences(text)
    .map(cleanClaim)
    .filter((sentence) => sentence.length > 12 && CLAIM_PATTERNS.some((pattern) => pattern.test(sentence)))
    .filter((sentence) => /^[A-Za-z0-9#]/.test(sentence))
    .filter((sentence) => !/add one of the following kinds|optionally add one or more|add the word ["']?fixes|do not use ["']?fixes|fixes\s+#<|kind\/|sig-|release note|which issue|what type of pr|user-facing change|documentation update/i.test(sentence))
    .slice(0, 6);
}

function claimEvidence(input: ProofAnalysisInput, text: string): ClaimEvidence[] {
  const claims = extractClaims(claimText(input));
  const diff = diffText(input);
  return claims.map((claim) => {
    const similarity = diff ? cosineLikeSimilarity(claim, diff) : 0;
    const vague = uniqueMeaningfulWords(claim).size < 5;
    const evidence: string[] = [];
    const missing: string[] = [];

    if (similarity > 0.22) evidence.push("Claim overlaps with changed files or supplied context.");
    if (/\d|%|\$|ms|sec|minutes|users|requests|tests?/i.test(claim)) evidence.push("Claim contains concrete measurable detail.");
    if (/test|spec|coverage|verified|validated|example|steps|owner|deadline|metric/i.test(text)) evidence.push("Nearby text includes verification signal.");

    if (!evidence.length) missing.push("No concrete supporting evidence found.");
    if (input.mode === "code_review" && !/test|spec|coverage|verified|rollback|risk/i.test(text)) missing.push("Missing tests, risk, or rollback proof.");
    if (input.mode === "docs" && !/example|```|step|expected|output/i.test(text)) missing.push("Missing example, snippet, or expected output.");
    if (input.mode === "hiring" && !/\d|%|\$|metric|link|github|project/i.test(text)) missing.push("Missing measurable outcome or verifiable project evidence.");
    if (input.mode === "communications" && !/owner|by \w+day|deadline|due|next|action|decided/i.test(text)) missing.push("Missing owner, deadline, decision, or next action.");

    return {
      claim,
      status: vague ? "too_vague" : evidence.length >= 2 ? "supported" : evidence.length === 1 ? "partial" : "unsupported",
      evidence,
      missing
    };
  });
}

function modeChecklist(input: ProofAnalysisInput, text: string): ProofChecklistItem[] {
  const lower = text.toLowerCase();
  const files = input.files ?? [];
  const fileNames = files.map((file) => file.filename.toLowerCase());

  if (input.mode === "code_review") {
    const riskyFiles = fileNames.some((name) => /auth|token|payment|billing|security|config|env|permission|database|migration/.test(name));
    const testChanged = fileNames.some((name) => /test|spec|__tests__/.test(name));
    const hasDiff = Boolean(diffText(input).trim());
    const hasCommits = Boolean(input.commits?.length);
    const hasComments = Boolean(input.comments?.length);
    return [
      checklistItem("Intent explained", hasAny(lower, [/because|so that|goal|intent|reason|fixes|adds|prevents/]), "high", "PR text should explain why the change exists."),
      checklistItem("Diff supports claims", hasDiff ? cosineLikeSimilarity(text, diffText(input)) > 0.12 : hasAny(lower, [/src\/|apps\/|\.ts|\.tsx|\.js|\.py|test|spec|migration|api|auth|billing|cache|database/]), "high", "PR claims should overlap with changed files or diff content."),
      checklistItem("Tests or verification present", testChanged || hasAny(lower, [/test|spec|verified|validated|coverage|manual check/]), riskyFiles ? "high" : "medium", "Risky changes need test or verification proof."),
      checklistItem("Risk or rollback noted", hasAny(lower, [/risk|rollback|migration|compat|breaking|fallback/]), riskyFiles ? "high" : "medium", "Reviewers need risk and rollback context."),
      checklistItem("Commit messages specific", hasCommits ? (input.commits ?? []).some((commit) => words(commit.message).length >= 4) : words(text).length >= 10, "medium", "Commits should describe concrete changes."),
      checklistItem("Useful review comments", hasComments ? (input.comments ?? []).some((comment) => /why|risk|test|case|line|because|consider|what/i.test(comment.body)) : true, "medium", "Review comments should add review signal."),
      checklistItem("Sensitive files highlighted", !riskyFiles || hasAny(lower, [/auth|token|payment|billing|security|config|migration|permission/]), "medium", "Sensitive file changes should be called out explicitly.")
    ];
  }

  if (input.mode === "docs") {
    const profile = docsProfile(lower);

    if (profile.isResourceList) {
      return [
        checklistItem("Clear resource purpose", hasAny(lower, [/awesome|resources|collection|curated|examples|templates|plugins/]), "high", "Resource lists should clearly explain what the collection helps readers find."),
        checklistItem("Organized categories", profile.headingCount >= 3, "high", "Resource lists need headings or categories so readers can scan quickly."),
        checklistItem("Useful item descriptions", hasAny(lower, [/ - | – |: | — /]) && profile.listItemCount >= 10, "medium", "Resource links should include short descriptions, not only names."),
        checklistItem("Contribution or selection guidance", hasAny(lower, [/contributing|submit|pull request|criteria|maintained|license/]), "medium", "Curated lists should explain how items are selected or updated."),
        checklistItem("Avoids circular explanation", !/(this section explains|as described above|the process is the process|various|comprehensive).{0,80}\1/i.test(lower), "medium", "Docs should add new information instead of restating headings.")
      ];
    }

    if (profile.isLibraryReadme) {
      return [
        checklistItem("Install or setup command present", profile.hasInstall, "high", "Library READMEs should show how to install or start the package."),
        checklistItem("Usage example present", profile.hasUsage && profile.hasCode, "high", "Library READMEs should include at least one usage example or API snippet."),
        checklistItem("API or feature explanation present", hasAny(lower, [/api|options|props|parameters|features|configuration|browser|node|typescript/]), "medium", "Readers need to understand the main API, feature, or configuration surface."),
        checklistItem("Expected behavior described", profile.hasExpectedOutput || hasAny(lower, [/renders|returns|fetches|runs|test|browser|request|response/]), "medium", "Strong docs describe what the command or example should do."),
        checklistItem("Troubleshooting or limits present", profile.hasTroubleshooting || hasAny(lower, [/requirements|prerequisite|node\.js|version|browser support|limitations|caveat/]), "low", "Mature READMEs should mention failure cases, limits, or support requirements.")
      ];
    }

    return [
      checklistItem("Concrete example present", hasAny(lower, [/example|for example|e\.g\.|sample|scenario/]), "high", "Docs should include at least one concrete example."),
      checklistItem("Step-by-step instruction present", hasAny(lower, [/step|first|next|then|run|click|open|install/]), "high", "Useful docs show a reader what to do."),
      checklistItem("Code or config snippet present", /```|npm |curl |json|yaml|\.env|config|api/.test(lower), "medium", "Technical docs should include snippets where possible."),
      checklistItem("Expected output present", hasAny(lower, [/expected|output|result|you should see|returns|response/]), "medium", "Readers need to know what success looks like."),
      checklistItem("Avoids circular explanation", !/(this section explains|as described above|the process is the process|various|comprehensive).{0,80}\1/i.test(lower), "medium", "Docs should add new information instead of restating headings.")
    ];
  }

  if (input.mode === "hiring") {
    return [
      checklistItem("Measurable outcomes", /\d|%|\$|x\b|users|requests|revenue|latency|cost|growth/i.test(text), "high", "Claims need metrics or scale."),
      checklistItem("Specific tools or projects", hasAny(lower, [/react|node|python|sql|aws|github|project|api|dashboard|pipeline|service/]), "high", "Applications need concrete project/tool evidence."),
      checklistItem("Role-specific evidence", hasAny(lower, [/built|led|owned|shipped|designed|implemented|debugged|launched/]), "medium", "The text should show what the person actually did."),
      checklistItem("Avoids generic templating", !MODE_FILLERS.hiring.some((phrase) => lower.includes(phrase)), "medium", "Generic hiring phrases need proof."),
      checklistItem("Verifiable context", hasAny(lower, [/link|github|portfolio|company|team|customer|production|case study/]), "medium", "Recruiters need ways to verify claims.")
    ];
  }

  return [
    checklistItem("Clear ask or decision", hasAny(lower, [/ask|need|decision|decided|approve|block|confirm|choose/]), "high", "Communication needs a clear ask or decision."),
    checklistItem("Owner present", hasAny(lower, [/owner|owns|assigned|@|by [a-z]+|i will|we will/]), "high", "Actionable messages identify who owns the next step."),
    checklistItem("Deadline or timing present", hasAny(lower, [/today|tomorrow|eod|deadline|due|by \w+day|before|after|at \d/]), "medium", "Actionable messages include timing."),
    checklistItem("Next action present", hasAny(lower, [/next|follow up|send|review|ship|schedule|update|reply|create/]), "high", "Readers should know what happens next."),
    checklistItem("Low corporate filler", !MODE_FILLERS.communications.some((phrase) => lower.includes(phrase)), "medium", "Inflated workplace phrasing should be reduced.")
  ];
}

function proofScore(checklist: ProofChecklistItem[], claims: ClaimEvidence[], text: string, mode: AnalysisMode) {
  const specificity = clamp((uniqueMeaningfulWords(text).size / Math.max(words(text).length, 1)) * 100);
  const evidenceCoverage = checklist.length ? (checklist.filter((item) => item.passed).length / checklist.length) * 100 : 0;
  const actionability = mode === "communications" ? countMatches(text, [/owner|deadline|next|action|due|decision/i]) * 20 : countMatches(text, [/test|verified|example|metric|owner|deadline|risk|rollback/i]) * 14;
  const contextAlignment = claims.length ? (claims.filter((claim) => claim.status === "supported" || claim.status === "partial").length / claims.length) * 100 : 45;
  const verification = countMatches(text, [/test|spec|verified|validated|example|expected|metric|\d|owner|deadline|due/i]) * 12;
  const base = specificity * 0.25 + evidenceCoverage * 0.25 + clamp(actionability) * 0.2 + contextAlignment * 0.2 + clamp(verification) * 0.1;
  const docsCalibration = mode === "docs" ? (evidenceCoverage >= 100 ? 18 : evidenceCoverage >= 80 ? 12 : evidenceCoverage >= 60 ? 6 : 0) : 0;
  return Math.round(clamp(base + docsCalibration));
}

function buildQuestions(mode: AnalysisMode, missing: ProofChecklistItem[], claims: ClaimEvidence[]) {
  const base: Record<AnalysisMode, string[]> = {
    code_review: ["What exact behavior changed, and why is this change needed?", "How was this tested, and what risky path could break?", "Which changed file proves the main PR claim?"],
    docs: ["What concrete example can a reader follow?", "What exact steps and expected output prove this works?", "Which claim needs a code snippet or configuration sample?"],
    hiring: ["What measurable outcome proves the strongest claim?", "Which project or artifact can verify this experience?", "What role-specific work did the candidate personally own?"],
    communications: ["What is the exact ask or decision?", "Who owns the next action and by when?", "What can be removed so the message is shorter and clearer?"]
  };
  const claimQuestion = claims.find((claim) => claim.status === "unsupported" || claim.status === "too_vague");
  return [
    ...base[mode],
    ...missing.slice(0, 2).map((item) => `Can the author add proof for: ${item.label}?`),
    ...(claimQuestion ? [`What evidence supports this claim: "${claimQuestion.claim}"?`] : [])
  ].slice(0, 6);
}

function buildFixPlan(mode: AnalysisMode, missing: ProofChecklistItem[], claims: ClaimEvidence[]): FixStep[] {
  const steps = missing
    .filter((item) => !item.passed)
    .slice(0, 4)
    .map((item) => ({
      title: `Add proof for ${item.label}`,
      detail: item.detail,
      priority: item.severity
    }));

  const unsupported = claims.find((claim) => claim.status === "unsupported" || claim.status === "too_vague");
  if (unsupported) {
    steps.push({
      title: "Support or remove vague claim",
      detail: `Add concrete evidence for "${unsupported.claim}" or rewrite it as a narrower factual statement.`,
      priority: "high"
    });
  }

  if (!steps.length) {
    steps.push({
      title: `Keep ${MODE_LABELS[mode]} proof intact`,
      detail: "The content has enough concrete proof. Preserve examples, verification details, and actionability during edits.",
      priority: "low"
    });
  }

  return steps.slice(0, 5);
}

function verdictLabel(verdict: ProofVerdict) {
  const labels: Record<ProofVerdict, string> = {
    strong_proof: "Strong Proof",
    needs_review: "Needs Review",
    high_risk: "High Risk",
    blocker: "Blocker",
    mostly_clear_needs_timing: "Mostly Clear, Needs Timing"
  };
  return labels[verdict];
}

function buildVerdict(mode: AnalysisMode, proof: number, hollowScore: number, failed: ProofChecklistItem[], claims: ClaimEvidence[]) {
  const highSeverityGaps = failed.filter((item) => item.severity === "high").length;
  const unsupportedClaims = claims.filter((claim) => claim.status === "unsupported" || claim.status === "too_vague").length;
  const missingTimingOnly = mode === "communications" && failed.length > 0 && failed.every((item) => /deadline|timing/i.test(item.label));

  let verdict: ProofVerdict;
  if (proof >= 75 && hollowScore < 40 && failed.length === 0 && unsupportedClaims === 0) verdict = "strong_proof";
  else if (missingTimingOnly && proof >= 50) verdict = "mostly_clear_needs_timing";
  else if (proof < 25 || highSeverityGaps >= 3 || hollowScore >= 80) verdict = "blocker";
  else if (proof < 45 || highSeverityGaps >= 2 || hollowScore >= 60) verdict = "high_risk";
  else verdict = "needs_review";

  const firstGap = failed[0]?.label;
  const reasons: Record<ProofVerdict, string> = {
    strong_proof: `${MODE_LABELS[mode]} has enough evidence, verification, and reviewability to be trusted.`,
    needs_review: firstGap ? `${MODE_LABELS[mode]} is useful, but ${failed.length} proof gap${failed.length === 1 ? "" : "s"} still need attention, starting with ${firstGap}.` : `${MODE_LABELS[mode]} covers the main checklist, but evidence density is still partial.`,
    high_risk: firstGap ? `${MODE_LABELS[mode]} has important proof gaps, including ${firstGap}, and should be reviewed before it is trusted.` : `${MODE_LABELS[mode]} has high hollow-score risk and needs closer review.`,
    blocker: firstGap ? `${MODE_LABELS[mode]} is missing critical proof, including ${firstGap}, so it should not be accepted as-is.` : `${MODE_LABELS[mode]} is too vague or risky to accept as-is.`,
    mostly_clear_needs_timing: "The message has a clear ask or next step, but it still needs deadline or timing clarity."
  };

  const nextActions: Record<ProofVerdict, string> = {
    strong_proof: "Preserve the current evidence and keep the proof details visible when sharing or exporting.",
    needs_review: failed[0] ? failed[0].detail : "Add one stronger evidence detail before sharing.",
    high_risk: failed[0] ? `Fix this first: ${failed[0].detail}` : "Ask for concrete evidence before approval.",
    blocker: failed[0] ? `Block or rewrite until this is resolved: ${failed[0].detail}` : "Rewrite with concrete evidence before review.",
    mostly_clear_needs_timing: "Add a deadline or response timeline without inventing fake names or dates."
  };

  return { verdict, verdictLabel: verdictLabel(verdict), verdictReason: reasons[verdict], nextAction: nextActions[verdict] };
}

export function analyzeProof(input: ProofAnalysisInput): ProofAnalysisResult {
  const text = combinedText(input);
  const hollowScore = scoreArtifact(input);
  const missingProof = modeChecklist(input, text);
  const claims = claimEvidence(input, text);
  const proof = proofScore(missingProof, claims, text, input.mode);
  const failed = missingProof.filter((item) => !item.passed);
  const questions = buildQuestions(input.mode, failed, claims);
  const fixPlan = buildFixPlan(input.mode, failed, claims);
  const verdict = buildVerdict(input.mode, proof, hollowScore.score, failed, claims);

  return {
    mode: input.mode,
    hollowScore,
    proofScore: proof,
    proofBand: proofBand(proof),
    ...verdict,
    missingProof,
    claims,
    questions,
    fixPlan,
    summary:
      proof >= 75
        ? `${MODE_LABELS[input.mode]} has strong evidence of human understanding.`
        : failed.length
          ? `${MODE_LABELS[input.mode]} looks incomplete: ${failed.length} proof checks need attention.`
          : `${MODE_LABELS[input.mode]} has the core proof checklist covered, but the evidence is still partial.`
  };
}

export function modeFromContext(context: string): AnalysisMode {
  if (context === "Documentation") return "docs";
  if (context === "Resume") return "hiring";
  if (context === "Team message") return "communications";
  return "code_review";
}
