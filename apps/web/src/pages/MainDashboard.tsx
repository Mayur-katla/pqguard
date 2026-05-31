import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Download,
  FileText,
  Gauge,
  Github,
  Loader2,
  MessageSquareText,
  ScanSearch,
  ShieldCheck,
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

const modes: Array<{ mode: AnalysisMode; label: string; icon: LucideIcon; helper: string }> = [
  { mode: "code_review", label: "Code Review", icon: Github, helper: "PR claims, diffs, commits" },
  { mode: "docs", label: "Docs", icon: FileText, helper: "README, docs, KB text" },
  { mode: "hiring", label: "Hiring", icon: UserRoundSearch, helper: "Resume or take-home text" },
  { mode: "communications", label: "Comms", icon: MessageSquareText, helper: "Slack, email, status notes" }
];

const inputPlaceholders: Record<AnalysisMode, string> = {
  code_review: "Paste a PR title, description, changed-file summary, reviewer comments, or release note...",
  docs: "Paste documentation, README, onboarding, or knowledge base text...",
  hiring: "Paste a resume section, cover letter, portfolio summary, or take-home explanation...",
  communications: "Paste a Slack message, email, meeting note, or status update..."
};

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-body-sm font-bold transition duration-200 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora disabled:cursor-not-allowed disabled:opacity-55";
const primaryButton = `${buttonBase} bg-brand-gradient text-white shadow-glow hover:-translate-y-0.5`;
const secondaryButton = `${buttonBase} border border-line/80 bg-panel/80 text-ink hover:-translate-y-0.5 hover:border-aurora/60 hover:bg-elevated`;
const fieldClass =
  "w-full rounded-lg border border-line/80 bg-panel/80 px-3.5 py-3 text-body-sm text-ink shadow-inner-line outline-none transition placeholder:text-faint hover:border-strongLine focus:border-aurora focus:ring-2 focus:ring-aurora/25";

function modeLabel(mode: AnalysisMode) {
  return modes.find((item) => item.mode === mode)?.label ?? mode;
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

export function MainDashboard() {
  const [mode, setMode] = useState<AnalysisMode>("code_review");
  const [text, setText] = useState("");
  const [proof, setProof] = useState<ProofAnalysisResult | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [selectedPr, setSelectedPr] = useState<PullRequestScore | null>(null);
  const [activeModal, setActiveModal] = useState<ModalName>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [token, setToken] = useState("");
  const [threshold, setThreshold] = useState(70);
  const [ciYaml, setCiYaml] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const sortedPrs = useMemo(() => [...(scan?.pullRequests ?? [])].sort((a, b) => b.score.score - a.score.score), [scan]);
  const topRisk = scan?.summary.topRisk[0] ?? sortedPrs[0] ?? null;
  const averageScore = scan?.summary.averageScore ?? 0;
  const failingCount = (scan?.summary.flag ?? 0) + (scan?.summary.block ?? 0);

  async function copyText(value: string, label = "Copied to clipboard.") {
    await navigator.clipboard.writeText(value);
    setMessage(label);
  }

  function buildScoreCard(result: ProofAnalysisResult) {
    return [
      "PRGuard live analysis",
      `Mode: ${modeLabel(result.mode)}`,
      `Hollow Score: ${result.hollowScore.score} / 100`,
      `Human Proof Score: ${result.proofScore} / 100`,
      `Status: ${result.hollowScore.band} with ${result.proofBand} proof`,
      `Open: ${window.location.origin}`
    ].join("\n");
  }

  async function handleAnalyze() {
    if (!text.trim()) {
      setMessage("Paste content before running analysis.");
      return;
    }

    setLoading(true);
    try {
      const result = await analyzeProof(mode, text, `${modeLabel(mode)} live input`);
      setProof(result);
      setMessage(`${modeLabel(mode)} proof score: ${result.proofScore}/100`);
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
    try {
      const result = await scanRepo(repoUrl, token);
      setScan(result);
      setSelectedPr(result.summary.topRisk[0] ?? result.pullRequests[0] ?? null);
      setActiveModal(null);
      setMessage(`Scanned ${result.summary.totalPrs} pull requests from ${result.repository.owner}/${result.repository.name}.`);
    } catch (error) {
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

  function openPr(pr: PullRequestScore) {
    setSelectedPr(pr);
    setActiveModal("details");
  }

  const latestQuestions = proof?.questions.join("\n") ?? "";
  const latestFixPlan = proof?.fixPlan.map((step) => `${step.title}: ${step.detail}`).join("\n") ?? "";

  return (
    <main className="min-h-screen bg-app-radial text-ink">
      <Toast message={message} tone={message.toLowerCase().includes("failed") || message.toLowerCase().includes("enter") || message.toLowerCase().includes("paste") ? "info" : "success"} onDismiss={() => setMessage("")} />

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

          <div className="grid gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:px-8 lg:py-10">
            <div className="min-w-0">
              <span className="text-eyebrow uppercase text-aurora">Live proof analysis console</span>
              <h1 className="mt-4 max-w-4xl text-display-md text-ink sm:text-display-lg xl:text-display-xl">Find content that looks complete but lacks human proof.</h1>
              <p className="mt-4 max-w-3xl text-body-lg text-muted">
                Analyze real GitHub PRs or pasted work artifacts across code review, docs, hiring, and communications. Every result returns a Hollow Score, Human Proof Score, questions, and a fix plan.
              </p>

              <section className="mt-6 rounded-2xl border border-line/80 bg-panel/80 p-4 shadow-soft backdrop-blur-xl">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Analysis mode">
                  {modes.map((item) => {
                    const Icon = item.icon;
                    const active = mode === item.mode;
                    return (
                      <button
                        className={`flex min-h-16 items-center gap-3 rounded-xl border px-3 py-3 text-left transition hover:-translate-y-0.5 ${
                          active ? "border-aurora/70 bg-brand-gradient text-white shadow-glow" : "border-line bg-elevated/70 text-muted hover:border-aurora/50 hover:text-ink"
                        }`}
                        key={item.mode}
                        type="button"
                        onClick={() => {
                          setMode(item.mode);
                          setProof(null);
                        }}
                      >
                        <Icon size={18} />
                        <span className="min-w-0">
                          <strong className="block text-body-sm">{item.label}</strong>
                          <small className="block text-caption opacity-80">{item.helper}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-caption font-bold uppercase text-muted">Live input</span>
                  <textarea
                    className={`${fieldClass} min-h-40 resize-y`}
                    aria-label="Paste content to analyze"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder={inputPlaceholders[mode]}
                  />
                </label>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button className={primaryButton} type="button" onClick={handleAnalyze} disabled={loading || !text.trim()}>
                    {loading ? <Loader2 className="animate-spin" size={17} /> : <Gauge size={17} />}
                    Analyze
                  </button>
                  <button className={secondaryButton} type="button" onClick={() => proof && copyText(latestQuestions, "Questions copied.")} disabled={!proof}>
                    <Clipboard size={17} />
                    Copy Questions
                  </button>
                  <button className={secondaryButton} type="button" onClick={() => proof && copyText(latestFixPlan, "Fix plan copied.")} disabled={!proof}>
                    <Clipboard size={17} />
                    Copy Fix Plan
                  </button>
                  <button className={secondaryButton} type="button" onClick={() => proof && copyText(buildScoreCard(proof), "Score card copied.")} disabled={!proof}>
                    <Clipboard size={17} />
                    Copy Score
                  </button>
                </div>

                {proof ? <ProofSummary proof={proof} /> : null}
              </section>
            </div>

            <aside className="rounded-2xl border border-aurora/20 bg-elevated/80 p-5 shadow-panel">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-caption font-bold uppercase text-muted">Current repository</span>
                  <strong className="mt-1 block truncate text-title-md text-ink">{scan ? `${scan.repository.owner}/${scan.repository.name}` : "Waiting for live scan"}</strong>
                </div>
                <Github className="text-aurora" size={22} />
              </div>
              <div className={`mx-auto my-8 grid aspect-square w-44 max-w-full place-items-center rounded-full bg-gradient-to-br text-5xl font-extrabold shadow-glow ${riskTone(averageScore)}`}>
                {scan ? averageScore : "--"}
              </div>
              <p className="text-body-md text-muted">
                {loading && !proof ? "Running live analysis..." : scan ? `Live scan complete with ${scan.summary.totalPrs} pull requests analyzed.` : "Scan a public GitHub repository to populate PR risk, evidence, and exportable reports."}
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <MiniStat label="PRs" value={scan?.summary.totalPrs ?? 0} />
                <MiniStat label="Blocked" value={scan?.summary.block ?? 0} />
                <MiniStat label="Clean" value={scan?.summary.clean ?? 0} />
              </div>
            </aside>
          </div>
        </div>

        <section className="flex flex-col gap-3 rounded-2xl border border-line/80 bg-panel/80 p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2 text-body-sm font-semibold text-muted">
            <Github size={18} /> Live GitHub data only
          </span>
          <div className="flex flex-col gap-2 xs:flex-row">
            <button className={secondaryButton} type="button" onClick={() => setActiveModal("export")} disabled={!scan}>
              <Download size={17} />
              Export
            </button>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Scan summary metrics">
          <MetricCard label="Average Hollow Score" value={scan?.summary.averageScore ?? "--"} icon={<Gauge size={18} />} tone={riskTone(averageScore)} helper="Risk across live PRs" />
          <MetricCard label="Top Proof Score" value={topRisk?.proof?.proofScore ?? "--"} icon={<ShieldCheck size={18} />} tone={proofTone(topRisk?.proof?.proofScore ?? 0)} helper="Best evidence signal" />
          <MetricCard label="Clean" value={scan?.summary.clean ?? 0} icon={<CheckCircle2 size={18} />} tone="from-proof to-emerald-300 text-inverse" helper="Ready or low risk" />
          <MetricCard label="Flag or Block" value={failingCount} icon={<AlertTriangle size={18} />} tone="from-flag to-block text-white" helper="Needs review first" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <Panel title="Hollow Score Heatmap" eyebrow="Risk map">
            {sortedPrs.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {sortedPrs.map((pr) => (
                  <button
                    className={`grid min-h-28 content-between rounded-xl bg-gradient-to-br p-3 text-left shadow-soft transition hover:-translate-y-0.5 ${riskTone(pr.score.score)}`}
                    key={pr.id}
                    type="button"
                    onClick={() => openPr(pr)}
                    aria-label={`Open PR ${pr.number}, hollow score ${pr.score.score}, proof score ${pr.proof.proofScore}`}
                  >
                    <span className="text-body-sm font-bold opacity-85">#{pr.number}</span>
                    <strong className="text-3xl font-extrabold">{pr.score.score}</strong>
                    <small className="text-caption font-bold opacity-85">proof {pr.proof.proofScore}</small>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState text="No PR data loaded. Scan a real GitHub repository to build the heatmap." />
            )}
          </Panel>

          <Panel title="Ranked Pull Requests" eyebrow="Evidence queue">
            {sortedPrs.length ? (
              <div className="grid gap-3">
                {sortedPrs.map((pr) => (
                  <button
                    className="flex items-start justify-between gap-4 rounded-xl border border-line/80 bg-elevated/70 p-3 text-left transition hover:-translate-y-0.5 hover:border-aurora/55"
                    key={pr.id}
                    type="button"
                    onClick={() => openPr(pr)}
                  >
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
              <EmptyState text="Scanned pull requests will appear here with proof questions and fix plans." />
            )}
          </Panel>
        </section>
      </section>

      <Modal title="Scan GitHub Repository" subtitle="Enter a public repository or provide a token for higher API limits and private access." open={activeModal === "scan"} onClose={() => setActiveModal(null)}>
        <div className="grid gap-4">
          <label>
            <span className="mb-2 block text-caption font-bold uppercase text-muted">Repository URL or owner/repo</span>
            <input className={fieldClass} value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="owner/repo or https://github.com/owner/repo" />
          </label>
          <label>
            <span className="mb-2 block text-caption font-bold uppercase text-muted">GitHub token</span>
            <input className={fieldClass} value={token} onChange={(event) => setToken(event.target.value)} type="password" placeholder="Optional" />
          </label>
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

function ProofSummary({ proof }: { proof: ProofAnalysisResult }) {
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <ProofCard proof={proof} />
      <div className="rounded-xl border border-line/80 bg-elevated/70 p-4">
        <span className="text-caption font-bold uppercase text-muted">Missing proof checklist</span>
        <div className="mt-3 grid gap-2">
          {proof.missingProof.map((item) => (
            <div className="flex items-start gap-3 rounded-lg border border-line/60 bg-panel/70 p-3" key={item.label}>
              {item.passed ? <CheckCircle2 className="mt-0.5 text-proof" size={17} /> : <AlertTriangle className="mt-0.5 text-review" size={17} />}
              <div>
                <strong className="block text-body-sm text-ink">{item.label}</strong>
                <p className="mt-1 text-body-sm text-muted">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
          <span className="inline-flex rounded-full border border-aurora/30 bg-aurora-soft/60 px-3 py-1 text-caption font-bold uppercase text-aurora-strong">{claim.status.replace("_", " ")}</span>
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
            <span className={`inline-flex rounded-full border px-3 py-1 text-caption font-bold uppercase ${priorityTone(step.priority)}`}>Step {index + 1} - {step.priority}</span>
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
