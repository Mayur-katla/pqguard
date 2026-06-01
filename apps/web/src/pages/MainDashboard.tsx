import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clipboard,
  Download,
  FileText,
  FileUp,
  Gauge,
  Github,
  ListChecks,
  Loader2,
  MessageSquareText,
  ScanSearch,
  ShieldCheck,
  Target,
  UserRoundSearch,
  Workflow
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { analyzeProof, downloadReport, getCiYaml, scanRepo } from "../lib/api";
import { extractUploadText } from "../lib/files";
import { maskSensitiveText } from "../lib/privacy";
import type { AnalysisMode, ClaimEvidence, FixStep, ProofAnalysisResult, PullRequestScore, ScanResult } from "../lib/types";
import { Modal } from "../components/Modal";
import { Toast } from "../components/Toast";

type ModalName = "scan" | "details" | "evidence" | "fix" | "ci" | "export" | null;
type ToastTone = "error" | "info" | "success";

interface TrackConfig {
  mode: AnalysisMode;
  label: string;
  icon: LucideIcon;
  helper: string;
  eyebrow: string;
  title: string;
  description: string;
  inputLabel: string;
  placeholder: string;
  upload: boolean;
  uploadLabel: string;
  uploadAccept: string;
}

const tracks: TrackConfig[] = [
  {
    mode: "code_review",
    label: "Code Review",
    icon: Github,
    helper: "PR claims, diffs, commits",
    eyebrow: "Track A",
    title: "Pull request proof scanner",
    description: "Scan GitHub pull requests or paste PR text to check intent, diff support, tests, reviewer signal, risk, and rollback proof.",
    inputLabel: "PR text",
    placeholder: "Paste a PR title, description, changed-file summary, reviewer comments, or release note...",
    upload: false,
    uploadLabel: "",
    uploadAccept: ""
  },
  {
    mode: "docs",
    label: "Docs",
    icon: FileText,
    helper: "README, docs, KB text",
    eyebrow: "Track B",
    title: "Documentation proof scanner",
    description: "Check docs for concrete examples, steps, snippets, expected output, circular wording, and missing reader proof.",
    inputLabel: "Documentation text",
    placeholder: "Paste documentation, README, onboarding, or knowledge base text...",
    upload: true,
    uploadLabel: "Upload docs",
    uploadAccept: ".pdf,.txt,.md,.markdown,.csv,.json,.log,.yml,.yaml"
  },
  {
    mode: "hiring",
    label: "Hiring",
    icon: UserRoundSearch,
    helper: "Resume or take-home text",
    eyebrow: "Track C",
    title: "Resume and hiring proof scanner",
    description: "Check resumes, cover letters, portfolios, and take-home writeups for measurable outcomes, owned work, tools, links, and proof.",
    inputLabel: "Resume or hiring text",
    placeholder: "Paste a resume section, cover letter, portfolio summary, or take-home explanation...",
    upload: true,
    uploadLabel: "Upload resume",
    uploadAccept: ".pdf,.txt,.md,.markdown"
  },
  {
    mode: "communications",
    label: "Comms",
    icon: MessageSquareText,
    helper: "Slack, email, status notes",
    eyebrow: "Track D",
    title: "Communication proof scanner",
    description: "Check messages for a clear ask or decision, owner, timing, next action, and low-filler wording.",
    inputLabel: "Message text",
    placeholder: "Paste a Slack message, email, meeting note, or status update...",
    upload: false,
    uploadLabel: "",
    uploadAccept: ""
  }
];

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-body-sm font-bold transition duration-200 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora disabled:cursor-not-allowed disabled:opacity-55";
const primaryButton = `${buttonBase} bg-brand-gradient text-white shadow-glow hover:-translate-y-0.5`;
const secondaryButton = `${buttonBase} border border-line/80 bg-panel/80 text-ink hover:-translate-y-0.5 hover:border-aurora/60 hover:bg-elevated`;
const fieldClass =
  "w-full rounded-lg border border-line/80 bg-panel/80 px-3.5 py-3 text-body-sm text-ink shadow-inner-line outline-none transition placeholder:text-faint hover:border-strongLine focus:border-aurora focus:ring-2 focus:ring-aurora/25";
const maxArtifactTextChars = 60_000;

function trackFor(mode: AnalysisMode) {
  return tracks.find((track) => track.mode === mode) ?? tracks[0];
}

function riskTone(score: number) {
  if (score >= 80) return "from-block to-rose-400 text-white";
  if (score >= 60) return "from-flag to-orange-300 text-white";
  if (score >= 40) return "from-review to-amber-200 text-inverse";
  return "from-proof to-emerald-300 text-inverse";
}

function proofTone(score: number) {
  if (score >= 80) return "from-proof to-emerald-300 text-inverse";
  if (score >= 60) return "from-aurora to-cyan-200 text-inverse";
  if (score >= 40) return "from-review to-amber-200 text-inverse";
  return "from-block to-rose-400 text-white";
}

function priorityTone(priority: string) {
  if (priority === "high") return "border-block/35 bg-block-soft/60 text-block-strong";
  if (priority === "medium") return "border-review/35 bg-review-soft/60 text-review-strong";
  return "border-aurora/30 bg-aurora-soft/70 text-aurora-strong";
}

function claimTone(status: ClaimEvidence["status"]) {
  if (status === "supported") return "border-proof/35 bg-proof-soft/60 text-proof-strong";
  if (status === "partial") return "border-review/35 bg-review-soft/60 text-review-strong";
  return "border-block/35 bg-block-soft/60 text-block-strong";
}

function verdictTone(verdict: ProofAnalysisResult["verdict"]) {
  if (verdict === "strong_proof") return "border-proof/45 bg-proof-soft/25";
  if (verdict === "mostly_clear_needs_timing") return "border-aurora/45 bg-aurora-soft/25";
  if (verdict === "needs_review") return "border-review/45 bg-review-soft/25";
  return "border-block/45 bg-block-soft/25";
}

function failedProofGaps(proof?: ProofAnalysisResult | null) {
  return proof?.missingProof.filter((item) => !item.passed) ?? [];
}

function visibleProofGapCount(proof: ProofAnalysisResult) {
  const aiGapCount = proof.aiReview?.status === "generated" ? proof.aiReview.weaknesses.length + proof.aiReview.issues.length : 0;
  return Math.max(failedProofGaps(proof).length, aiGapCount);
}

function aiGenerated(proof: ProofAnalysisResult) {
  return proof.aiReview?.status === "generated";
}

function primaryReport(proof: ProofAnalysisResult) {
  const hasAi = aiGenerated(proof);
  const ai = proof.aiReview;
  const deterministicMerits = proof.missingProof.filter((item) => item.passed).map((item) => item.label);
  const deterministicDemerits = proof.missingProof.filter((item) => !item.passed).map((item) => `${item.label}: ${item.detail}`);
  const deterministicFixes = proof.fixPlan.map((step) => `${step.title}: ${step.detail}`);
  const aiConfidence = typeof ai?.confidence === "number" ? Math.round(ai.confidence * 100) : undefined;
  const successRate = hasAi && typeof aiConfidence === "number" ? Math.max(aiConfidence, proof.proofScore) : proof.proofScore;

  return {
    source: hasAi ? "AI-first report" : "Guardrail fallback",
    sourceDetail: hasAi ? [ai?.provider, ai?.model].filter(Boolean).join(" / ") : "Deterministic proof checks",
    successRate,
    successHelper: hasAi ? "AI confidence checked against guardrails" : "Proof readiness from guardrails",
    cause: ai?.summary || proof.verdictReason,
    merits: (hasAi && ai?.strengths.length ? ai.strengths : deterministicMerits).slice(0, 5),
    demerits: (hasAi && [...(ai?.weaknesses ?? []), ...(ai?.issues ?? [])].length ? [...(ai?.weaknesses ?? []), ...(ai?.issues ?? [])] : deterministicDemerits).slice(0, 5),
    fixes: (hasAi && ai?.recommendations.length ? ai.recommendations : deterministicFixes).slice(0, 4),
    needsHumanReview: hasAi ? Boolean(ai?.needsHumanReview) : proof.verdict !== "strong_proof",
    usingAi: hasAi
  };
}

function topReviewRisks(scan: ScanResult | null) {
  if (!scan) return [];
  return scan.pullRequests
    .flatMap((pr) => failedProofGaps(pr.proof).slice(0, 2).map((gap) => ({ pr, gap })))
    .sort((a, b) => (b.gap.severity === "high" ? 2 : b.gap.severity === "medium" ? 1 : 0) - (a.gap.severity === "high" ? 2 : a.gap.severity === "medium" ? 1 : 0) || b.pr.score.score - a.pr.score.score)
    .slice(0, 3);
}

function repositoryVerdict(scan: ScanResult | null) {
  if (!scan) {
    return {
      label: "No Scan Yet",
      reason: "Scan a GitHub repository to rank pull requests by hollow score, proof gaps, and reviewer action.",
      action: "Start with Track A by scanning owner/repo or a GitHub repository URL.",
      tone: "border-aurora/35 bg-aurora-soft/20"
    };
  }

  const blockerCount = scan.pullRequests.filter((pr) => pr.proof.verdict === "blocker" || pr.score.band === "Block").length;
  const highRiskCount = scan.pullRequests.filter((pr) => pr.proof.verdict === "high_risk" || pr.score.band === "Flag").length;
  const gaps = scan.pullRequests.reduce((sum, pr) => sum + visibleProofGapCount(pr.proof), 0);
  const first = scan.summary.topRisk[0] ?? scan.pullRequests[0];

  if (blockerCount > 0) {
    return {
      label: "Blocker",
      reason: `${blockerCount} PR${blockerCount === 1 ? "" : "s"} need critical proof before approval. The highest-risk PR is #${first?.number ?? "--"}.`,
      action: `Review PR #${first?.number ?? "--"} first and ask for test, rollback, or changed-file proof before merge.`,
      tone: "border-block/45 bg-block-soft/25"
    };
  }

  if (highRiskCount > 0 || gaps > 0) {
    return {
      label: "Needs Review",
      reason: `${gaps} proof gap${gaps === 1 ? "" : "s"} were found across ${scan.summary.totalPrs} scanned pull requests.`,
      action: first ? `Start with PR #${first.number}; it has the highest hollow score and needs reviewer proof first.` : "Open the ranked PR queue and ask for missing proof.",
      tone: "border-review/45 bg-review-soft/25"
    };
  }

  return {
    label: "Strong Proof",
    reason: "The scanned pull requests have enough visible evidence, verification, and reviewability for a first-pass review.",
    action: "Export the report or continue monitoring future PRs with the CI gate.",
    tone: "border-proof/45 bg-proof-soft/25"
  };
}

export function MainDashboard() {
  const [mode, setMode] = useState<AnalysisMode>("code_review");
  const [text, setText] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [proof, setProof] = useState<ProofAnalysisResult | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [selectedPr, setSelectedPr] = useState<PullRequestScore | null>(null);
  const [activeModal, setActiveModal] = useState<ModalName>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [token, setToken] = useState("");
  const [threshold, setThreshold] = useState(70);
  const [ciYaml, setCiYaml] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStage, setScanStage] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<ToastTone>("info");

  const activeTrack = trackFor(mode);
  const isCodeReview = mode === "code_review";

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [message]);

  function notify(value: string, tone: ToastTone = "info") {
    setMessage(value);
    setMessageTone(tone);
  }

  function notifyLongInput() {
    const extra = text.length - maxArtifactTextChars;
    notify(`This document is ${extra.toLocaleString()} characters over the limit. Shorten it under ${maxArtifactTextChars.toLocaleString()} characters or test the most relevant README section.`, "error");
  }

  const sortedPrs = useMemo(() => [...(scan?.pullRequests ?? [])].sort((a, b) => b.score.score - a.score.score), [scan]);
  const topRisk = scan?.summary.topRisk[0] ?? sortedPrs[0] ?? null;
  const averageScore = scan?.summary.averageScore ?? 0;
  const failingCount = (scan?.summary.flag ?? 0) + (scan?.summary.block ?? 0);
  const latestQuestions = proof?.questions.join("\n") ?? "";
  const latestFixPlan = proof?.fixPlan.map((step) => `${step.title}: ${step.detail}`).join("\n") ?? "";

  async function copyText(value: string, label = "Copied to clipboard.") {
    await navigator.clipboard.writeText(maskSensitiveText(value));
    notify(label, "success");
  }

  function buildScoreCard(result: ProofAnalysisResult) {
    return [
      "PRGuard live analysis",
      `Mode: ${trackFor(result.mode).label}`,
      `Hollow Score: ${result.hollowScore.score} / 100`,
      `Human Proof Score: ${result.proofScore} / 100`,
      `Verdict: ${result.verdictLabel}`,
      `Reason: ${result.verdictReason}`,
      `Next Action: ${result.nextAction}`,
      `Open: ${window.location.origin}`
    ].join("\n");
  }

  async function handleFileUpload(file: File | undefined) {
    if (!file) return;
    if (!activeTrack.upload) {
      notify(`${activeTrack.label} is paste-only. Paste the content directly into the text box.`, "error");
      return;
    }
    if (file.size > 5_000_000) {
      notify("Upload a PDF or text file under 5 MB.", "error");
      return;
    }

    setLoading(true);
    try {
      const content = await extractUploadText(file);
      if (!content.trim()) {
        notify("No readable text was found in this file. Try exporting the file as text or paste the content directly.", "error");
        return;
      }
      if (content.length > maxArtifactTextChars) {
        notify(`The extracted text is too long: ${content.length.toLocaleString()} characters. Keep it under ${maxArtifactTextChars.toLocaleString()}.`, "error");
        return;
      }
      setText(content);
      setUploadedFileName(file.name);
      setProof(null);
      notify(`Loaded ${file.name} with ${content.length.toLocaleString()} readable characters.`, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not read this file. Paste the content directly instead.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    if (!text.trim()) {
      notify("Paste or upload content before running analysis.", "error");
      return;
    }
    if (text.length > maxArtifactTextChars) {
      notify(`Keep the input under ${maxArtifactTextChars.toLocaleString()} characters. This content has ${text.length.toLocaleString()}.`, "error");
      return;
    }

    setLoading(true);
    try {
      const result = await analyzeProof(mode, text, uploadedFileName || `${activeTrack.label} live input`);
      setProof(result);
      notify(`${activeTrack.label} proof score: ${result.proofScore}/100`, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Analysis failed. Check the input and try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleScan() {
    if (!repoUrl.trim()) {
      notify("Enter a public GitHub repository first.", "error");
      return;
    }

    setLoading(true);
    setScanProgress(8);
    setScanStage("Connecting to GitHub");

    const stages = [
      { at: 22, label: "Reading repository metadata" },
      { at: 42, label: "Fetching pull requests" },
      { at: 64, label: "Collecting files, commits, and comments" },
      { at: 84, label: "Scoring evidence and proof" },
      { at: 92, label: "Preparing report" }
    ];
    let stageIndex = 0;
    const timer = window.setInterval(() => {
      const next = stages[stageIndex];
      if (!next) return;
      setScanProgress(next.at);
      setScanStage(next.label);
      stageIndex += 1;
    }, 900);

    try {
      const result = await scanRepo(repoUrl, token);
      window.clearInterval(timer);
      setScanProgress(100);
      setScanStage("Scan complete");
      setScan(result);
      setSelectedPr(result.summary.topRisk[0] ?? result.pullRequests[0] ?? null);
      setActiveModal(null);
      notify(`Scanned ${result.summary.totalPrs} pull requests from ${result.repository.owner}/${result.repository.name}.`, "success");
    } catch (error) {
      window.clearInterval(timer);
      setScanProgress(0);
      setScanStage("");
      notify(error instanceof Error ? error.message : "Scan failed. Check the repository URL and token, then try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCiYaml() {
    setLoading(true);
    try {
      setCiYaml(await getCiYaml(threshold));
      notify("CI workflow generated.", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not generate YAML.", "error");
    } finally {
      setLoading(false);
    }
  }

  function selectMode(nextMode: AnalysisMode) {
    setMode(nextMode);
    setProof(null);
    setText("");
    setUploadedFileName("");
  }

  function openPr(pr: PullRequestScore) {
    setSelectedPr(pr);
    setActiveModal("details");
  }

  return (
    <main className="min-h-screen bg-app-radial text-ink">
      <Toast
        message={message}
        tone={messageTone}
        onDismiss={() => setMessage("")}
      />

      <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-3 py-3 sm:px-5 lg:px-6">
        <div className="overflow-hidden rounded-2xl border border-line/80 bg-panel-glass shadow-panel backdrop-blur-2xl animate-fade-up">
          <nav className="flex flex-col gap-4 border-b border-line/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6" aria-label="Primary">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow">
                <ShieldCheck size={26} />
              </span>
              <div className="min-w-0">
                <strong className="block text-title-md text-ink">PRGuard</strong>
                <span className="block text-body-sm text-muted">Human Proof Scanner</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 xs:flex-row">
              <button className={secondaryButton} type="button" onClick={() => setActiveModal("ci")}>
                <Workflow size={17} />
                CI Gate
              </button>
              <button className={primaryButton} type="button" onClick={() => setActiveModal("scan")}>
                <ScanSearch size={17} />
                Scan Repo
              </button>
            </div>
          </nav>

          <section className="track-layout px-4 py-6 lg:px-8 lg:py-10">
            <TrackSwitcher mode={mode} onSelect={selectMode} />
            <TrackInput
              track={activeTrack}
              text={text}
              proof={proof}
              uploadedFileName={uploadedFileName}
              loading={loading}
              onTextChange={(value) => {
                setText(value);
                setProof(null);
              }}
              onAnalyze={handleAnalyze}
              onOverLimit={notifyLongInput}
              onUpload={handleFileUpload}
              onCopyQuestions={() => proof && copyText(latestQuestions, "Questions copied.")}
              onCopyFixPlan={() => proof && copyText(latestFixPlan, "Fix plan copied.")}
              onCopyScore={() => proof && copyText(buildScoreCard(proof), "Score card copied.")}
            />
          </section>
        </div>

        {isCodeReview && proof ? <ArtifactWorkspace track={activeTrack} proof={proof} onCopy={copyText} /> : null}

        {isCodeReview ? (
          <CodeReviewWorkspace
            scan={scan}
            sortedPrs={sortedPrs}
            topRisk={topRisk}
            averageScore={averageScore}
            failingCount={failingCount}
            scanProgress={scanProgress}
            scanStage={scanStage}
            loading={loading}
            onScan={() => setActiveModal("scan")}
            onExport={() => setActiveModal("export")}
            onOpenPr={openPr}
          />
        ) : (
          <ArtifactWorkspace track={activeTrack} proof={proof} onCopy={copyText} />
        )}
      </section>

      <Modal title="Scan GitHub Repository" subtitle="Enter a repository and watch the scan progress." open={activeModal === "scan"} onClose={() => setActiveModal(null)}>
        <div className="grid gap-4">
          <label>
            <span className="mb-2 block text-caption font-bold uppercase text-muted">Repository URL or owner/repo</span>
            <input className={fieldClass} value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="owner/repo or https://github.com/owner/repo" />
          </label>
          <label>
            <span className="mb-2 block text-caption font-bold uppercase text-muted">GitHub token</span>
            <input className={fieldClass} value={token} onChange={(event) => setToken(event.target.value)} type="password" placeholder="Optional" />
          </label>
          {loading && scanProgress > 0 ? <ProgressBar value={scanProgress} label={scanStage} /> : null}
          <button className={primaryButton} type="button" onClick={handleScan} disabled={loading || !repoUrl.trim()}>
            {loading ? <Loader2 className="animate-spin" size={17} /> : <ScanSearch size={17} />}
            Start Live Scan
          </button>
        </div>
      </Modal>

      <Modal title={selectedPr ? `PR #${selectedPr.number}` : "PR Details"} subtitle={selectedPr?.title} open={activeModal === "details"} onClose={() => setActiveModal(null)} wide>
        {selectedPr ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <ScoreCard pr={selectedPr} />
            <ProofCard proof={selectedPr.proof} onCopy={copyText} />
            <button className={secondaryButton} type="button" onClick={() => setActiveModal("evidence")}>
              Evidence Map
            </button>
            <button className={secondaryButton} type="button" onClick={() => setActiveModal("fix")}>
              Fix Plan
            </button>
          </div>
        ) : null}
      </Modal>

      <Modal title="Evidence Map" subtitle="Claims mapped against concrete evidence." open={activeModal === "evidence"} onClose={() => setActiveModal(null)} wide>
        {selectedPr ? <EvidenceMap claims={selectedPr.proof.claims} /> : <EmptyState text="Open a PR first." />}
      </Modal>

      <Modal title="Fix Plan" subtitle="Actionable steps for safer review." open={activeModal === "fix"} onClose={() => setActiveModal(null)} wide>
        {selectedPr ? <FixPlan steps={selectedPr.proof.fixPlan} onCopy={copyText} /> : <EmptyState text="Open a PR first." />}
      </Modal>

      <Modal title="CI Gate" subtitle="Generate a GitHub Actions gate for Hollow Score review thresholds." open={activeModal === "ci"} onClose={() => setActiveModal(null)} wide>
        <div className="grid gap-4">
          <label>
            <span className="mb-2 block text-caption font-bold uppercase text-muted">Block threshold</span>
            <input className={fieldClass} value={threshold} min={1} max={100} type="number" onChange={(event) => setThreshold(Number(event.target.value))} />
          </label>
          <button className={primaryButton} type="button" onClick={handleCiYaml} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={17} /> : <Workflow size={17} />}
            Generate Workflow
          </button>
          {ciYaml ? <pre className="max-h-96 overflow-auto rounded-xl border border-line bg-overlay/70 p-4 text-body-sm text-ink">{ciYaml}</pre> : null}
        </div>
      </Modal>

      <Modal title="Export Report" subtitle="Download the current live scan." open={activeModal === "export"} onClose={() => setActiveModal(null)}>
        <div className="grid grid-cols-2 gap-3">
          {(["json", "csv", "md", "pdf"] as const).map((format) => (
            <button className="min-h-24 rounded-xl border border-line/80 bg-elevated p-4 text-title-md font-bold text-ink transition hover:-translate-y-0.5 hover:border-aurora/60" type="button" key={format} disabled={!scan} onClick={() => scan && downloadReport(scan, format)}>
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      </Modal>
    </main>
  );
}

function TrackSwitcher({ mode, onSelect }: { mode: AnalysisMode; onSelect: (mode: AnalysisMode) => void }) {
  const activeTrack = trackFor(mode);
  const ActiveIcon = activeTrack.icon;
  return (
    <aside className="rounded-2xl border border-line/80 bg-panel/80 p-4 shadow-soft backdrop-blur-xl">
      <span className="text-eyebrow uppercase text-aurora">Choose analysis track</span>
      <div className="mt-4 grid gap-2">
        {tracks.map((track) => {
          const Icon = track.icon;
          const active = mode === track.mode;
          return (
            <button
              className={`flex min-h-16 items-center gap-3 rounded-xl border px-3 py-3 text-left transition hover:-translate-y-0.5 ${
                active ? "border-aurora/70 bg-brand-gradient text-white shadow-glow" : "border-line bg-elevated/70 text-muted hover:border-aurora/50 hover:text-ink"
              }`}
              key={track.mode}
              type="button"
              onClick={() => onSelect(track.mode)}
            >
              <Icon size={18} />
              <span className="min-w-0">
                <strong className="block text-body-sm">{track.label}</strong>
                <small className="block text-caption opacity-80">{track.helper}</small>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-5 rounded-xl border border-aurora/25 bg-aurora-soft/30 p-4">
        <div className="flex items-center gap-2 text-aurora-strong">
          <ActiveIcon size={18} />
          <strong className="text-body-sm">{activeTrack.eyebrow}</strong>
        </div>
        <p className="mt-2 text-body-sm text-muted">{activeTrack.description}</p>
      </div>
    </aside>
  );
}

function TrackInput({
  track,
  text,
  proof,
  uploadedFileName,
  loading,
  onTextChange,
  onAnalyze,
  onOverLimit,
  onUpload,
  onCopyQuestions,
  onCopyFixPlan,
  onCopyScore
}: {
  track: TrackConfig;
  text: string;
  proof: ProofAnalysisResult | null;
  uploadedFileName: string;
  loading: boolean;
  onTextChange: (value: string) => void;
  onAnalyze: () => void;
  onOverLimit: () => void;
  onUpload: (file: File | undefined) => void;
  onCopyQuestions: () => void;
  onCopyFixPlan: () => void;
  onCopyScore: () => void;
}) {
  const nearLimit = text.length > maxArtifactTextChars * 0.9;
  const overLimit = text.length > maxArtifactTextChars;

  return (
    <section className="min-w-0 rounded-2xl border border-line/80 bg-panel/80 p-4 shadow-soft backdrop-blur-xl">
      <span className="text-eyebrow uppercase text-aurora">{track.eyebrow}</span>
      <h1 className="mt-3 text-display-md text-ink sm:text-display-lg xl:text-display-xl">{track.title}</h1>
      <p className="mt-3 max-w-3xl text-body-lg text-muted">{track.description}</p>

      <label className="mt-5 block">
        <span className="mb-2 flex flex-wrap items-center justify-between gap-2 text-caption font-bold uppercase text-muted">
          <span>{track.inputLabel}</span>
          <span className={overLimit ? "text-block-strong" : nearLimit ? "text-review-strong" : "text-muted"}>
            {text.length.toLocaleString()} / {maxArtifactTextChars.toLocaleString()}
          </span>
        </span>
        <textarea className={`${fieldClass} min-h-44 resize-y`} aria-label={track.inputLabel} value={text} onChange={(event) => onTextChange(event.target.value)} placeholder={track.placeholder} />
      </label>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button className={primaryButton} type="button" onClick={overLimit ? onOverLimit : onAnalyze} disabled={loading || !text.trim()}>
          {loading ? <Loader2 className="animate-spin" size={17} /> : <Gauge size={17} />}
          Analyze
        </button>
        {track.upload ? (
          <label className={`${secondaryButton} cursor-pointer`}>
            <FileUp size={17} />
            {track.uploadLabel}
            <input className="sr-only" type="file" accept={track.uploadAccept} onChange={(event) => onUpload(event.target.files?.[0])} />
          </label>
        ) : null}
        <button className={secondaryButton} type="button" onClick={onCopyQuestions} disabled={!proof}>
          <Clipboard size={17} />
          Copy Questions
        </button>
        <button className={secondaryButton} type="button" onClick={onCopyFixPlan} disabled={!proof}>
          <Clipboard size={17} />
          Copy Fix Plan
        </button>
        <button className={secondaryButton} type="button" onClick={onCopyScore} disabled={!proof}>
          <Clipboard size={17} />
          Copy Score
        </button>
      </div>

      {uploadedFileName ? <p className="mt-3 text-body-sm text-muted">Loaded file: {uploadedFileName}</p> : null}
    </section>
  );
}

function CodeReviewWorkspace({
  scan,
  sortedPrs,
  topRisk,
  averageScore,
  failingCount,
  scanProgress,
  scanStage,
  loading,
  onScan,
  onExport,
  onOpenPr
}: {
  scan: ScanResult | null;
  sortedPrs: PullRequestScore[];
  topRisk: PullRequestScore | null;
  averageScore: number;
  failingCount: number;
  scanProgress: number;
  scanStage: string;
  loading: boolean;
  onScan: () => void;
  onExport: () => void;
  onOpenPr: (pr: PullRequestScore) => void;
}) {
  const verdict = repositoryVerdict(scan);
  const reviewRisks = topReviewRisks(scan);

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className={`rounded-2xl border p-4 shadow-soft backdrop-blur-xl ${verdict.tone}`}>
          <span className="text-caption font-bold uppercase text-muted">Repository Verdict</span>
          <h2 className="mt-2 text-title-xl text-ink">{verdict.label}</h2>
          <p className="mt-2 text-body-sm text-muted">{verdict.reason}</p>
          <p className="mt-3 text-body-sm font-bold text-ink">{verdict.action}</p>
        </div>
        <Panel title="Top Review Risks" eyebrow="What to inspect first">
          {reviewRisks.length ? (
            <ol className="grid gap-2">
              {reviewRisks.map(({ pr, gap }) => (
                <li className="rounded-lg border border-line/60 bg-elevated/70 p-3 text-body-sm text-muted" key={`${pr.id}-${gap.label}`}>
                  <strong className="text-ink">PR #{pr.number}:</strong> {gap.label}. {gap.detail}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState text="Scan results with proof gaps will show the top three reviewer risks here." />
          )}
        </Panel>
      </section>

      <section className="code-scan-layout">
        <Panel title="Repository Scan" eyebrow="Track A live data">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <strong className="block text-title-md text-ink">{scan ? `${scan.repository.owner}/${scan.repository.name}` : "No repository scanned"}</strong>
                <span className="text-body-sm text-muted">{scan ? `${scan.summary.totalPrs} pull requests analyzed` : "Scan a repository to show PR-only risk, evidence, and exports."}</span>
              </div>
              <div className="flex flex-col gap-2 xs:flex-row">
                <button className={primaryButton} type="button" onClick={onScan}>
                  <ScanSearch size={17} />
                  Scan Repo
                </button>
                <button className={secondaryButton} type="button" onClick={onExport} disabled={!scan}>
                  <Download size={17} />
                  Export
                </button>
              </div>
            </div>
            {loading && scanProgress > 0 ? <ProgressBar value={scanProgress} label={scanStage} /> : null}
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="PRs" value={scan?.summary.totalPrs ?? 0} />
              <MiniStat label="Blocked" value={scan?.summary.block ?? 0} />
              <MiniStat label="Clean" value={scan?.summary.clean ?? 0} />
            </div>
          </div>
        </Panel>

        <Panel title="Pull Request Risk" eyebrow="Scan summary">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Average Hollow Score" value={scan?.summary.averageScore ?? "--"} icon={<Gauge size={18} />} tone={riskTone(averageScore)} helper="Risk across scanned PRs" />
            <MetricCard label="Top Proof Score" value={topRisk?.proof?.proofScore ?? "--"} icon={<ShieldCheck size={18} />} tone={proofTone(topRisk?.proof?.proofScore ?? 0)} helper="Best evidence signal" />
            <MetricCard label="Clean" value={scan?.summary.clean ?? 0} icon={<CheckCircle2 size={18} />} tone="from-proof to-emerald-300 text-inverse" helper="Ready or low risk" />
            <MetricCard label="Flag or Block" value={failingCount} icon={<AlertTriangle size={18} />} tone="from-flag to-block text-white" helper="Needs review first" />
          </div>
        </Panel>
      </section>

      <section className="heatmap-layout">
        <Panel title="Hollow Score Heatmap" eyebrow="PR risk map">
          {sortedPrs.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {sortedPrs.map((pr) => (
                <button
                  className={`grid min-h-28 content-between rounded-xl bg-gradient-to-br p-3 text-left shadow-soft transition hover:-translate-y-0.5 ${riskTone(pr.score.score)}`}
                  key={pr.id}
                  type="button"
                  onClick={() => onOpenPr(pr)}
                  aria-label={`Open PR ${pr.number}, hollow score ${pr.score.score}, proof score ${pr.proof.proofScore}`}
                >
                  <span className="text-body-sm font-bold opacity-85">#{pr.number}</span>
                  <strong className="text-3xl font-extrabold">{pr.score.score}</strong>
                  <small className="text-caption font-bold opacity-85">proof {pr.proof.proofScore}</small>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState text="No PR data loaded. Scan a repository to build the Track A heatmap." />
          )}
        </Panel>

        <Panel title="Ranked Pull Requests" eyebrow="Evidence queue">
          {sortedPrs.length ? (
            <div className="grid gap-3">
              {sortedPrs.map((pr) => (
                <button className="flex items-start justify-between gap-4 rounded-xl border border-line/80 bg-elevated/70 p-3 text-left transition hover:-translate-y-0.5 hover:border-aurora/55" key={pr.id} type="button" onClick={() => onOpenPr(pr)}>
                  <span className="min-w-0">
                    <small className="text-caption font-bold uppercase text-muted">#{pr.number} by {pr.author}</small>
                    <strong className="mt-1 block text-body-md text-ink">{pr.title}</strong>
                    <span className="mt-1 line-clamp-2 block text-body-sm text-muted">
                      Risk reason: {failedProofGaps(pr.proof)[0]?.label ?? pr.proof.verdictReason}
                    </span>
                  </span>
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br font-extrabold ${riskTone(pr.score.score)}`}>{pr.score.score}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState text="Scanned pull requests will appear here with proof questions, claims, merits, and fix plans." />
          )}
        </Panel>
      </section>
    </>
  );
}

function ArtifactWorkspace({ track, proof, onCopy }: { track: TrackConfig; proof: ProofAnalysisResult | null; onCopy: (text: string, label?: string) => void }) {
  if (!proof) {
    return (
      <section className="grid gap-4 md:grid-cols-3">
        <InfoPanel icon={<ShieldCheck size={19} />} title="AI-first report" text={`Run ${track.label} analysis to get a concise report with cause, merits, demerits, and fixes.`} />
        <InfoPanel icon={<ListChecks size={19} />} title="Guardrails" text="Deterministic proof checks keep the report consistent and provide fallback when AI is unavailable." />
        <InfoPanel icon={<BarChart3 size={19} />} title="Success rate" text="The report shows estimated readiness from AI confidence and proof guardrails, not a perfect accuracy claim." />
      </section>
    );
  }

  const report = primaryReport(proof);
  const proofGapCount = visibleProofGapCount(proof);
  const guardrailFailures = failedProofGaps(proof).slice(0, 4);
  const reportText = [
    `${track.label} PRGuard report`,
    `Verdict: ${proof.verdictLabel}`,
    `Success Rate: ${report.successRate}%`,
    `Cause: ${report.cause}`,
    `Merits:\n${report.merits.map((item) => `- ${item}`).join("\n") || "- None found"}`,
    `Demerits:\n${report.demerits.map((item) => `- ${item}`).join("\n") || "- None found"}`,
    `Recommended Fixes:\n${report.fixes.map((item) => `- ${item}`).join("\n") || "- No fixes returned"}`,
    `Next Action: ${proof.nextAction}`
  ].join("\n\n");

  return (
    <>
      <VerdictCard proof={proof} />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Success Rate" value={`${report.successRate}%`} icon={<ShieldCheck size={18} />} tone={proofTone(report.successRate)} helper={report.successHelper} />
        <MetricCard label="Report Source" value={report.usingAi ? "AI" : "Rules"} icon={<Gauge size={18} />} tone="from-aurora to-cyan-200 text-inverse" helper={report.sourceDetail || report.source} />
        <MetricCard label="Proof Gaps" value={proofGapCount} icon={<AlertTriangle size={18} />} tone="from-flag to-block text-white" helper={proofGapCount ? "Needs attention" : "No checklist gaps"} />
        <MetricCard label="Reviewer Check" value={report.needsHumanReview ? "Yes" : "No"} icon={<Target size={18} />} tone={report.needsHumanReview ? "from-review to-amber-200 text-inverse" : "from-proof to-emerald-300 text-inverse"} helper={report.needsHumanReview ? "Review before trusting" : "Low follow-up need"} />
      </section>

      <section className="analysis-two-column">
        <Panel title="AI Proof Report" eyebrow={report.source}>
          <div className="grid gap-4">
            <div className="rounded-xl border border-line/70 bg-elevated/70 p-4">
              <span className="text-caption font-bold uppercase text-muted">Cause</span>
              <p className="mt-2 text-body-sm text-muted">{report.cause}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SignalList title="Merits" empty="No strong merits found." items={report.merits} tone="proof" />
              <SignalList title="Demerits" empty="No important demerits found." items={report.demerits} tone="block" />
            </div>
            <SignalList title="Recommended Fixes" empty="No fixes returned." items={report.fixes} tone="proof" />
            <div className="flex flex-col gap-2 xs:flex-row">
              <button className={secondaryButton} type="button" onClick={() => onCopy(reportText, "AI report copied.")}>
                <Clipboard size={17} />
                Copy Report
              </button>
            </div>
          </div>
        </Panel>
        <Panel title="Guardrail Check" eyebrow="Fallback and consistency">
          <div className="grid gap-3">
            <p className="text-body-sm text-muted">
              Deterministic guardrails still check proof gaps, hollow score, and claims so the AI report stays reviewable.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <MiniStat label="Proof Score" value={proof.proofScore} />
              <MiniStat label="Hollow Score" value={proof.hollowScore.score} />
              <MiniStat label="Claims" value={proof.claims.length} />
            </div>
            {guardrailFailures.length ? (
              <div className="grid gap-2">
                {guardrailFailures.map((item) => (
                  <div className="rounded-lg border border-line/60 bg-elevated/70 p-3" key={item.label}>
                    <strong className="block text-body-sm text-ink">{item.label}</strong>
                    <p className="mt-1 text-body-sm text-muted">{item.detail}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No major deterministic guardrail failures found." />
            )}
          </div>
        </Panel>
      </section>

      <section className="analysis-two-column">
        <Panel title="Reviewer Questions" eyebrow="Only what matters next">
          <ul className="grid gap-2">
            {proof.questions.slice(0, 4).map((question) => (
              <li className="rounded-lg border border-line/60 bg-elevated/70 p-3 text-body-sm text-muted" key={question}>
                {question}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Claim Map" eyebrow="Compact evidence view">
          <EvidenceMap claims={proof.claims.slice(0, 3)} />
        </Panel>
      </section>
    </>
  );
}

function VerdictCard({ proof }: { proof: ProofAnalysisResult }) {
  return (
    <section className={`rounded-2xl border p-4 shadow-soft backdrop-blur-xl ${verdictTone(proof.verdict)}`}>
      <span className="text-caption font-bold uppercase text-muted">Verdict</span>
      <h2 className="mt-2 text-title-xl text-ink">{proof.verdictLabel}</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <span className="text-caption font-bold uppercase text-muted">Reason</span>
          <p className="mt-1 text-body-sm text-muted">{proof.verdictReason}</p>
        </div>
        <div>
          <span className="text-caption font-bold uppercase text-muted">Next Action</span>
          <p className="mt-1 text-body-sm font-bold text-ink">{proof.nextAction}</p>
        </div>
      </div>
    </section>
  );
}

function InfoPanel({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-2xl border border-line/80 bg-panel/80 p-4 shadow-soft">
      <span className="grid h-10 w-10 place-items-center rounded-lg border border-aurora/25 bg-aurora-soft/40 text-aurora">{icon}</span>
      <h2 className="mt-4 text-title-md text-ink">{title}</h2>
      <p className="mt-2 text-body-sm text-muted">{text}</p>
    </article>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-line/80 bg-elevated/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-body-sm font-bold text-ink">{label || "Working"}</span>
        <span className="text-body-sm font-bold text-aurora">{value}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-overlay">
        <div className="h-full rounded-full bg-brand-gradient transition-all duration-500 ease-smooth" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function SignalList({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: "proof" | "block" }) {
  const color = tone === "proof" ? "text-proof-strong border-proof/30 bg-proof-soft/40" : "text-block-strong border-block/30 bg-block-soft/40";
  return (
    <div className="rounded-xl border border-line/70 bg-panel/70 p-3">
      <strong className="text-body-sm text-ink">{title}</strong>
      <div className="mt-3 grid gap-2">
        {items.length ? (
          items.map((item) => (
            <span className={`rounded-lg border px-3 py-2 text-body-sm ${color}`} key={item}>
              {item}
            </span>
          ))
        ) : (
          <span className="text-body-sm text-muted">{empty}</span>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid min-h-14 place-items-center rounded-lg border border-line/70 bg-panel/70 px-2 text-center">
      <strong className="text-body-md text-ink">{value}</strong>
      <span className="text-caption font-bold uppercase text-muted">{label}</span>
    </div>
  );
}

function MetricCard({ label, value, helper, icon, tone }: { label: string; value: string | number; helper: string; icon: ReactNode; tone: string }) {
  return (
    <div className="rounded-2xl border border-line/80 bg-panel/80 p-4 shadow-soft backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <span className="text-caption font-bold uppercase text-muted">{label}</span>
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-aurora/25 bg-aurora-soft/40 text-aurora">{icon}</span>
      </div>
      <strong className={`mt-4 grid min-h-14 w-fit min-w-16 place-items-center rounded-xl bg-gradient-to-br px-3 text-3xl font-extrabold ${tone}`}>{value}</strong>
      <p className="mt-3 text-body-sm text-muted">{helper}</p>
    </div>
  );
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line/80 bg-panel/80 p-4 shadow-soft backdrop-blur-xl">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <span className="text-caption font-bold uppercase text-muted">{eyebrow}</span>
          <h2 className="mt-1 text-title-xl text-ink">{title}</h2>
        </div>
      </header>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-line/80 bg-elevated/50 p-5 text-body-sm text-muted">{text}</div>;
}

function ScoreCard({ pr }: { pr: PullRequestScore }) {
  return (
    <article className="rounded-xl border border-line/80 bg-elevated/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-caption font-bold uppercase text-muted">{pr.author} opened this PR</span>
          <h3 className="mt-1 text-title-lg text-ink">{pr.score.band}</h3>
        </div>
        <span className={`grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-br text-xl font-extrabold ${riskTone(pr.score.score)}`}>{pr.score.score}</span>
      </div>
      <p className="mt-3 text-body-sm text-muted">{pr.score.summary}</p>
      <div className="mt-4 grid gap-2">
        {pr.score.components.map((component) => (
          <div className="flex justify-between gap-3 rounded-lg border border-line/60 bg-panel/70 p-3" key={component.name}>
            <span className="text-body-sm text-muted">{component.name}</span>
            <strong className="text-body-sm text-ink">{component.score}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function ProofCard({ proof, onCopy }: { proof: ProofAnalysisResult; onCopy?: (text: string, label?: string) => void }) {
  const report = primaryReport(proof);
  const questionText = proof.questions.join("\n");
  const reportText = [
    `Verdict: ${proof.verdictLabel}`,
    `Success Rate: ${report.successRate}%`,
    `Cause: ${report.cause}`,
    `Merits:\n${report.merits.map((item) => `- ${item}`).join("\n") || "- None found"}`,
    `Demerits:\n${report.demerits.map((item) => `- ${item}`).join("\n") || "- None found"}`,
    `Recommended Fixes:\n${report.fixes.map((item) => `- ${item}`).join("\n") || "- No fixes returned"}`
  ].join("\n\n");

  return (
    <article className="rounded-xl border border-line/80 bg-elevated/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-caption font-bold uppercase text-muted">{report.source}</span>
          <h3 className="mt-1 text-title-lg text-ink">{proof.verdictLabel}</h3>
        </div>
        <span className={`grid h-14 w-16 place-items-center rounded-xl bg-gradient-to-br text-xl font-extrabold ${proofTone(report.successRate)}`}>{report.successRate}%</span>
      </div>
      <p className="mt-3 text-body-sm text-muted">{report.cause}</p>
      <div className="mt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <SignalList title="Merits" empty="No strong merits found." items={report.merits.slice(0, 3)} tone="proof" />
          <SignalList title="Demerits" empty="No important demerits found." items={report.demerits.slice(0, 3)} tone="block" />
        </div>
      </div>
      {onCopy ? (
        <div className="mt-4 flex flex-col gap-2 xs:flex-row">
          <button className={secondaryButton} type="button" onClick={() => onCopy(questionText, "Questions copied.")}>
            Copy Questions
          </button>
          <button className={secondaryButton} type="button" onClick={() => onCopy(reportText, "Report copied.")}>
            Copy Report
          </button>
        </div>
      ) : null}
    </article>
  );
}

function EvidenceMap({ claims }: { claims: ClaimEvidence[] }) {
  if (!claims.length) return <EmptyState text="No explicit claims were detected. The text may be too short or too vague." />;

  return (
    <div className="grid gap-3">
      {claims.map((claim) => (
        <article className="rounded-xl border border-line/80 bg-elevated/70 p-4" key={claim.claim}>
          <span className={`inline-flex rounded-full border px-3 py-1 text-caption font-bold uppercase ${claimTone(claim.status)}`}>{claim.status.replace("_", " ")}</span>
          <h3 className="mt-3 text-title-md text-ink">{claim.claim}</h3>
          <p className="mt-2 text-body-sm text-muted">{claim.evidence.length ? claim.evidence.join(" ") : "No supporting evidence found."}</p>
          {claim.missing.length ? <p className="mt-2 text-body-sm text-review-strong">Missing: {claim.missing.join(" ")}</p> : null}
        </article>
      ))}
    </div>
  );
}

function FixPlan({ steps, onCopy }: { steps: FixStep[]; onCopy: (text: string, label?: string) => void }) {
  const text = steps.map((step) => `${step.title}: ${step.detail}`).join("\n");

  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        {steps.map((step, index) => (
          <article className="rounded-xl border border-line/80 bg-elevated/70 p-4" key={step.title}>
            <span className={`inline-flex rounded-full border px-3 py-1 text-caption font-bold uppercase ${priorityTone(step.priority)}`}>
              Step {index + 1} - {step.priority}
            </span>
            <h3 className="mt-3 text-title-md text-ink">{step.title}</h3>
            <p className="mt-2 text-body-sm text-muted">{step.detail}</p>
          </article>
        ))}
      </div>
      <button className={primaryButton} type="button" onClick={() => onCopy(text, "Fix plan copied.")}>
        <Clipboard size={17} />
        Copy Fix Plan
      </button>
    </div>
  );
}
