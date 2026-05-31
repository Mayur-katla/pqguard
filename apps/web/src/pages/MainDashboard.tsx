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
import type { AnalysisMode, ClaimEvidence, FixStep, ProofAnalysisResult, PullRequestScore, ScanResult } from "../lib/types";
import { Modal } from "../components/Modal";
import { Toast } from "../components/Toast";

type ModalName = "scan" | "details" | "evidence" | "fix" | "ci" | "export" | null;

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
    uploadLabel: ""
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
    uploadLabel: "Upload TXT/MD docs"
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
    uploadLabel: "Upload TXT/MD resume"
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
    upload: true,
    uploadLabel: "Upload TXT/MD note"
  }
];

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-body-sm font-bold transition duration-200 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora disabled:cursor-not-allowed disabled:opacity-55";
const primaryButton = `${buttonBase} bg-brand-gradient text-white shadow-glow hover:-translate-y-0.5`;
const secondaryButton = `${buttonBase} border border-line/80 bg-panel/80 text-ink hover:-translate-y-0.5 hover:border-aurora/60 hover:bg-elevated`;
const fieldClass =
  "w-full rounded-lg border border-line/80 bg-panel/80 px-3.5 py-3 text-body-sm text-ink shadow-inner-line outline-none transition placeholder:text-faint hover:border-strongLine focus:border-aurora focus:ring-2 focus:ring-aurora/25";

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

  const activeTrack = trackFor(mode);
  const isCodeReview = mode === "code_review";

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const sortedPrs = useMemo(() => [...(scan?.pullRequests ?? [])].sort((a, b) => b.score.score - a.score.score), [scan]);
  const topRisk = scan?.summary.topRisk[0] ?? sortedPrs[0] ?? null;
  const averageScore = scan?.summary.averageScore ?? 0;
  const failingCount = (scan?.summary.flag ?? 0) + (scan?.summary.block ?? 0);
  const latestQuestions = proof?.questions.join("\n") ?? "";
  const latestFixPlan = proof?.fixPlan.map((step) => `${step.title}: ${step.detail}`).join("\n") ?? "";

  async function copyText(value: string, label = "Copied to clipboard.") {
    await navigator.clipboard.writeText(value);
    setMessage(label);
  }

  function buildScoreCard(result: ProofAnalysisResult) {
    return [
      "PRGuard live analysis",
      `Mode: ${trackFor(result.mode).label}`,
      `Hollow Score: ${result.hollowScore.score} / 100`,
      `Human Proof Score: ${result.proofScore} / 100`,
      `Status: ${result.hollowScore.band} with ${result.proofBand} proof`,
      `Open: ${window.location.origin}`
    ].join("\n");
  }

  async function handleFileUpload(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_000_000) {
      setMessage("Upload a text file under 1 MB.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (["pdf", "doc", "docx"].includes(extension)) {
      setMessage("PDF/DOCX parsing is not built in yet. Export to TXT/MD or paste the text.");
      return;
    }

    const content = await file.text();
    setText(content);
    setUploadedFileName(file.name);
    setProof(null);
    setMessage(`Loaded ${file.name}.`);
  }

  async function handleAnalyze() {
    if (!text.trim()) {
      setMessage("Paste or upload content before running analysis.");
      return;
    }

    setLoading(true);
    try {
      const result = await analyzeProof(mode, text, uploadedFileName || `${activeTrack.label} live input`);
      setProof(result);
      setMessage(`${activeTrack.label} proof score: ${result.proofScore}/100`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleScan() {
    if (!repoUrl.trim()) {
      setMessage("Enter a public GitHub repository first.");
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
      setMessage(`Scanned ${result.summary.totalPrs} pull requests from ${result.repository.owner}/${result.repository.name}.`);
    } catch (error) {
      window.clearInterval(timer);
      setScanProgress(0);
      setScanStage("");
      setMessage(error instanceof Error ? error.message : "Scan failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCiYaml() {
    setLoading(true);
    try {
      setCiYaml(await getCiYaml(threshold));
      setMessage("CI workflow generated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate YAML.");
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
        tone={message.toLowerCase().includes("failed") || message.toLowerCase().includes("enter") || message.toLowerCase().includes("paste") || message.toLowerCase().includes("not built") ? "info" : "success"}
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
                <span className="block text-body-sm text-muted">Human Review Proof Scanner</span>
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
              onUpload={handleFileUpload}
              onCopyQuestions={() => proof && copyText(latestQuestions, "Questions copied.")}
              onCopyFixPlan={() => proof && copyText(latestFixPlan, "Fix plan copied.")}
              onCopyScore={() => proof && copyText(buildScoreCard(proof), "Score card copied.")}
            />
          </section>
        </div>

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
  onUpload: (file: File | undefined) => void;
  onCopyQuestions: () => void;
  onCopyFixPlan: () => void;
  onCopyScore: () => void;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-line/80 bg-panel/80 p-4 shadow-soft backdrop-blur-xl">
      <span className="text-eyebrow uppercase text-aurora">{track.eyebrow}</span>
      <h1 className="mt-3 text-display-md text-ink sm:text-display-lg xl:text-display-xl">{track.title}</h1>
      <p className="mt-3 max-w-3xl text-body-lg text-muted">{track.description}</p>

      <label className="mt-5 block">
        <span className="mb-2 block text-caption font-bold uppercase text-muted">{track.inputLabel}</span>
        <textarea className={`${fieldClass} min-h-44 resize-y`} aria-label={track.inputLabel} value={text} onChange={(event) => onTextChange(event.target.value)} placeholder={track.placeholder} />
      </label>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button className={primaryButton} type="button" onClick={onAnalyze} disabled={loading || !text.trim()}>
          {loading ? <Loader2 className="animate-spin" size={17} /> : <Gauge size={17} />}
          Analyze
        </button>
        {track.upload ? (
          <label className={`${secondaryButton} cursor-pointer`}>
            <FileUp size={17} />
            {track.uploadLabel}
            <input className="sr-only" type="file" accept=".txt,.md,.markdown,.csv,.json,.log,.yml,.yaml" onChange={(event) => onUpload(event.target.files?.[0])} />
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
  return (
    <>
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
                    <span className="mt-1 line-clamp-2 block text-body-sm text-muted">{pr.proof.summary}</span>
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
        <InfoPanel icon={<ListChecks size={19} />} title="Checklist" text={`Run ${track.label} analysis to see passed and missing proof checks.`} />
        <InfoPanel icon={<Target size={19} />} title="Claim Map" text="Claims are mapped to concrete evidence, partial support, or missing proof." />
        <InfoPanel icon={<BarChart3 size={19} />} title="Metrics" text="Hollow score, proof score, density, filler, and issue counts appear here." />
      </section>
    );
  }

  const merits = proof.missingProof.filter((item) => item.passed).map((item) => item.label);
  const demerits = proof.missingProof.filter((item) => !item.passed).map((item) => item.label);
  const metricEntries = Object.entries(proof.hollowScore.metrics);

  return (
    <>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Human Proof" value={proof.proofScore} icon={<ShieldCheck size={18} />} tone={proofTone(proof.proofScore)} helper={proof.proofBand} />
        <MetricCard label="Hollow Score" value={proof.hollowScore.score} icon={<Gauge size={18} />} tone={riskTone(proof.hollowScore.score)} helper={proof.hollowScore.band} />
        <MetricCard label="Missing Checks" value={demerits.length} icon={<AlertTriangle size={18} />} tone="from-flag to-block text-white" helper="Needs attention" />
        <MetricCard label="Claims Found" value={proof.claims.length} icon={<Target size={18} />} tone="from-aurora to-cyan-200 text-inverse" helper="Mapped to evidence" />
      </section>

      <section className="analysis-two-column">
        <ProofCard proof={proof} onCopy={onCopy} />
        <Panel title="Merits and Demerits" eyebrow={`${track.label} analysis`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <SignalList title="Merits" empty="No strong proof checks passed yet." items={merits} tone="proof" />
            <SignalList title="Demerits" empty="No missing proof checks found." items={demerits} tone="block" />
          </div>
        </Panel>
      </section>

      <section className="analysis-two-column">
        <Panel title="Issue Breakdown" eyebrow="What to fix">
          <div className="grid gap-2">
            {proof.missingProof.map((item) => (
              <div className="flex items-start gap-3 rounded-lg border border-line/60 bg-elevated/70 p-3" key={item.label}>
                {item.passed ? <CheckCircle2 className="mt-0.5 text-proof" size={17} /> : <AlertTriangle className="mt-0.5 text-review" size={17} />}
                <div>
                  <strong className="block text-body-sm text-ink">{item.label}</strong>
                  <p className="mt-1 text-body-sm text-muted">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Scoring Metrics" eyebrow="Signals">
          <div className="grid gap-2 sm:grid-cols-2">
            {metricEntries.map(([name, value]) => (
              <MiniStat key={name} label={name.replace(/[A-Z]/g, " $&")} value={value} />
            ))}
          </div>
        </Panel>
      </section>

      <section className="analysis-two-column">
        <Panel title="Claim to Evidence Map" eyebrow="Evidence">
          <EvidenceMap claims={proof.claims} />
        </Panel>
        <Panel title="Fix Plan" eyebrow="Next actions">
          <FixPlan steps={proof.fixPlan} onCopy={onCopy} />
        </Panel>
      </section>
    </>
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
  const questionText = proof.questions.join("\n");
  const fixText = proof.fixPlan.map((step) => `${step.title}: ${step.detail}`).join("\n");

  return (
    <article className="rounded-xl border border-line/80 bg-elevated/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-caption font-bold uppercase text-muted">Human Proof Score</span>
          <h3 className="mt-1 text-title-lg text-ink">{proof.proofBand}</h3>
        </div>
        <span className={`grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-br text-xl font-extrabold ${proofTone(proof.proofScore)}`}>{proof.proofScore}</span>
      </div>
      <p className="mt-3 text-body-sm text-muted">{proof.summary}</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniStat label="Hollow" value={proof.hollowScore.score} />
        <MiniStat label="Missing" value={proof.missingProof.filter((item) => !item.passed).length} />
        <MiniStat label="Claims" value={proof.claims.length} />
      </div>
      <div className="mt-4">
        <span className="text-caption font-bold uppercase text-muted">Questions</span>
        <ul className="mt-2 grid gap-2">
          {proof.questions.slice(0, 4).map((question) => (
            <li className="rounded-lg border border-line/60 bg-panel/70 p-3 text-body-sm text-muted" key={question}>
              {question}
            </li>
          ))}
        </ul>
      </div>
      {onCopy ? (
        <div className="mt-4 flex flex-col gap-2 xs:flex-row">
          <button className={secondaryButton} type="button" onClick={() => onCopy(questionText, "Questions copied.")}>
            Copy Questions
          </button>
          <button className={secondaryButton} type="button" onClick={() => onCopy(fixText, "Fix plan copied.")}>
            Copy Fix Plan
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
