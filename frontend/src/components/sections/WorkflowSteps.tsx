import { useEffect, useMemo, useState, type DragEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Code2,
  Copy,
  Download,
  FileCode2,
  FileText,
  FolderOpen,
  GitCompare,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

type SourceMode = 'zip' | 'paste' | 'sample';
type WorkspaceStatus = 'idle' | 'loading' | 'complete' | 'error';
type DetailTab = 'findings' | 'diff' | 'verification' | 'export';

interface Finding {
  id: string;
  rule_id: string;
  file_path: string;
  line_number: number;
  code_snippet: string;
  suggested_replacement: string;
  severity: string;
  automation: string;
  rule_name: string;
  why_changed: string;
  migration_advice: string;
  description: string;
}

interface FileVerification {
  valid: boolean;
  status: string;
  error_message?: string | null;
  line_number?: number | null;
  column_number?: number | null;
}

interface ScannedFile {
  file_path: string;
  original_code: string;
  transformed_code: string;
  diff_text: string;
  findings: Finding[];
  verification: FileVerification;
}

interface MigrationSummary {
  total_files_scanned: number;
  total_findings: number;
  readiness_score: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  automatic_count: number;
  manual_review_count: number;
}

interface MigrationResponse {
  report: { summary: MigrationSummary; findings: Finding[] };
  files: ScannedFile[];
  verification: {
    total_files: number;
    verified_files: number;
    failed_files: number;
    all_valid: boolean;
    scope: string;
  };
}

interface SampleRepository { id: string; name: string; filename: string }
interface Explanation { summary: string; rationale: string; breaking_change_risk: string; migration_steps: string[]; ai_generated: boolean }
interface ApiError { detail?: string }

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace(/\/+$/, '');
const progressStages = ['Scanning Repository', 'Detecting SDK Version', 'Parsing AST', 'Matching Rules', 'Generating Codemods', 'Running Verification', 'Generating Report'];

function downloadFile(name: string, content: string, type: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function WorkflowSteps() {
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<SourceMode>('zip');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<WorkspaceStatus>('idle');
  const [result, setResult] = useState<MigrationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<SampleRepository[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const [activeFile, setActiveFile] = useState(0);
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('findings');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status !== 'loading') return;
    const timer = window.setInterval(() => setProgressIndex((current) => Math.min(current + 1, progressStages.length - 1)), 550);
    return () => window.clearInterval(timer);
  }, [status]);

  const setZipFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) { setError('Please choose a .zip repository archive.'); return; }
    setSelectedFile(file); setMode('zip'); setError(null); setResult(null);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => { event.preventDefault(); setZipFile(event.dataTransfer.files[0]); };

  const scan = async (request: () => Promise<Response>) => {
    setStatus('loading'); setProgressIndex(0); setError(null); setResult(null); setActiveFinding(null); setExplanation(null);
    try {
      const response = await request();
      const payload = (await response.json().catch(() => null)) as MigrationResponse | ApiError | null;
      if (!response.ok) throw new Error((payload as ApiError | null)?.detail || 'LUME could not scan this source.');
      setProgressIndex(progressStages.length - 1); setResult(payload as MigrationResponse); setStatus('complete'); setActiveFile(0); setDetailTab('findings');
    } catch (requestError) {
      setStatus('error'); setError(requestError instanceof Error ? requestError.message : 'LUME could not reach the migration engine.');
    }
  };

  const startMigration = async () => {
    if (mode === 'zip') {
      if (!selectedFile) { setError('Add a ZIP repository before starting the migration.'); return; }
      const formData = new FormData(); formData.append('file', selectedFile);
      await scan(() => fetch(`${API}/scan/upload`, { method: 'POST', body: formData })); return;
    }
    if (mode === 'paste') {
      if (!code.trim()) { setError('Paste Python code before starting the migration.'); return; }
      await scan(() => fetch(`${API}/scan/raw`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: 'pasted_code.py', code }) })); return;
    }
    await scan(() => fetch(`${API}/scan/sample/${selectedSampleId || 'all'}`, { method: 'POST' }));
  };

  const loadSampleRepository = async () => {
    setMode('sample'); setStatus('loading'); setProgressIndex(0); setError(null);
    try {
      const response = await fetch(`${API}/samples`);
      const payload = (await response.json().catch(() => null)) as SampleRepository[] | ApiError | null;
      if (!response.ok) throw new Error((payload as ApiError | null)?.detail || 'LUME could not load sample repositories.');
      const available = Array.isArray(payload) ? payload : []; setSamples(available); setSelectedSampleId(available[0]?.id ?? null); setStatus('idle');
    } catch (requestError) { setStatus('error'); setError(requestError instanceof Error ? requestError.message : 'LUME could not reach the migration engine.'); }
  };

  const explainFinding = async (finding: Finding) => {
    setActiveFinding(finding); setExplanation(null); setDetailTab('findings');
    try {
      const response = await fetch(`${API}/explain`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ finding }) });
      if (response.ok) setExplanation((await response.json()) as Explanation);
    } catch { /* The deterministic finding details remain available if optional explanation fails. */ }
  };

  const currentFile = result?.files[activeFile];
  const allFindings = useMemo(() => result?.files.flatMap((file) => file.findings) ?? [], [result]);
  const hasInput = mode === 'zip' ? Boolean(selectedFile) : mode === 'paste' ? Boolean(code.trim()) : Boolean(selectedSampleId);

  const copyCode = async () => {
    if (!currentFile) return;
    await navigator.clipboard.writeText(currentFile.transformed_code);
    setCopied(true); window.setTimeout(() => setCopied(false), 1600);
  };

  const exportMarkdown = async () => {
    if (!result) return;
    const response = await fetch(`${API}/export/markdown`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result.report) });
    if (!response.ok) return;
    const payload = await response.json() as { markdown: string };
    downloadFile('Lume_Migration_Report.md', payload.markdown, 'text/markdown');
  };

  const exportJson = () => result && downloadFile('Lume_Migration_Report.json', JSON.stringify(result, null, 2), 'application/json');
  const exportDiff = () => result && downloadFile('Lume_Migration.diff', result.files.map((file) => file.diff_text).join('\n'), 'text/plain');
  const exportPatch = () => result && downloadFile('Lume_Migration.patch', result.files.map((file) => file.diff_text).join('\n'), 'text/x-patch');

  return (
    <section aria-labelledby="workflow-title" className="relative px-6 pb-16 pt-4 sm:px-9 sm:pb-20 lg:px-12 xl:px-16" id="workflow">
      <motion.div animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-[90rem]" initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }} transition={{ duration: 0.5 }}>
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div><p className="font-mono text-xs uppercase tracking-[0.18em] text-brand-orange">Migration workspace</p><h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.045em] text-ink-primary sm:text-3xl" id="workflow-title">Bring your codebase into LUME.</h2></div>
          <p className="max-w-sm text-sm leading-6 text-ink-muted">Upload a repository, paste a focused snippet, or start with the bundled samples.</p>
        </div>

        <div className="grid overflow-hidden rounded-panel border border-line bg-surface-panel/75 shadow-panel lg:grid-cols-[0.92fr_1.08fr]">
          <div className="border-b border-line p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="mb-6 flex items-center justify-between"><div><p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ink-subtle">Input source</p><p className="mt-1 text-sm font-semibold text-ink-primary">Choose how to begin</p></div><span className="rounded-full border border-status/30 bg-status/5 px-2.5 py-1 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-status">Local analysis</span></div>
            <div aria-label="Migration input source" className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-base/70 p-1" role="tablist">
              {[{ id: 'zip' as const, label: 'Upload ZIP', icon: Upload }, { id: 'paste' as const, label: 'Paste Code', icon: Code2 }, { id: 'sample' as const, label: 'Sample Repo', icon: FolderOpen }].map((tab) => { const Icon = tab.icon; const active = mode === tab.id; return <button aria-selected={active} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[0.6875rem] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange ${active ? 'bg-surface-elevated text-ink-primary shadow-panel' : 'text-ink-subtle hover:text-ink-muted'}`} key={tab.id} onClick={() => { setMode(tab.id); setError(null); }} role="tab" type="button"><Icon aria-hidden="true" size={16} />{tab.label}</button>; })}
            </div>
            {mode === 'zip' && <label className="mt-5 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-brand-red/45 bg-brand-red/5 px-6 text-center transition-colors hover:border-brand-orange hover:bg-brand-red/10" htmlFor="repository-upload" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}><input accept=".zip,application/zip" className="sr-only" id="repository-upload" onChange={(event) => setZipFile(event.target.files?.[0])} type="file" /><span className="mb-3 grid h-12 w-12 place-items-center rounded-xl border border-brand-red/30 bg-surface-elevated text-brand-orange shadow-glow-primary"><Upload aria-hidden="true" size={22} /></span><span className="font-display text-sm font-bold text-ink-primary">{selectedFile ? selectedFile.name : 'Drop your ZIP here'}</span><span className="mt-1 text-xs text-ink-muted">{selectedFile ? 'Ready for local analysis' : 'or click to browse your repository'}</span></label>}
            {mode === 'paste' && <label className="mt-5 block" htmlFor="code-input"><span className="sr-only">Paste Python code</span><textarea className="min-h-48 w-full resize-y rounded-2xl border border-line bg-surface-base px-4 py-4 font-mono text-xs leading-6 text-ink-primary outline-none transition-colors placeholder:text-ink-subtle focus:border-brand-orange/70 focus:ring-2 focus:ring-brand-orange/20" id="code-input" onChange={(event) => { setCode(event.target.value); setError(null); setResult(null); }} placeholder={'import openai\n\nresponse = openai.ChatCompletion.create(...)'} value={code} /></label>}
            {mode === 'sample' && <div className="mt-5 flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-brand-orange/40 bg-brand-orange/5 px-6 text-center"><span className="mb-3 grid h-12 w-12 place-items-center rounded-xl border border-brand-orange/30 bg-surface-elevated text-brand-orange shadow-glow-primary"><FolderOpen aria-hidden="true" size={22} /></span><p className="font-display text-sm font-bold text-ink-primary">Bundled sample repository</p><p className="mt-1 max-w-xs text-xs leading-5 text-ink-muted">Run LUME against included migration examples.</p>{samples.length > 0 && <select className="mt-4 w-full max-w-xs rounded-xl border border-line bg-surface-base px-3 py-2 text-xs font-semibold text-ink-primary outline-none" onChange={(event) => setSelectedSampleId(event.target.value)} value={selectedSampleId ?? ''}>{samples.map((sample) => <option key={sample.id} value={sample.id}>{sample.name}</option>)}</select>}<button className="mt-4 text-xs font-bold text-brand-orange underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange" onClick={loadSampleRepository} type="button">Load sample repository</button></div>}
            {error && <p className="mt-4 flex items-center gap-2 text-xs text-brand-orange" role="alert"><AlertCircle aria-hidden="true" size={15} />{error}</p>}
            <div className="mt-5 flex items-center justify-between gap-4"><p className="text-xs text-ink-subtle">No code leaves your machine.</p><button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-brand-orange/70 bg-brand-gradient px-4 text-sm font-bold text-ink-primary shadow-glow-primary transition-[transform,box-shadow] hover:shadow-glow-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange disabled:pointer-events-none disabled:opacity-50" disabled={status === 'loading' || !hasInput} onClick={startMigration} type="button">{status === 'loading' ? <Loader2 aria-hidden="true" className="animate-spin" size={17} /> : <ArrowRight aria-hidden="true" size={17} />}{status === 'loading' ? 'Analyzing' : 'Start Migration'}</button></div>
          </div>

          <div className="flex min-h-[25rem] flex-col p-5 sm:p-7">
            {status === 'loading' ? <ProgressPanel progressIndex={progressIndex} /> : result ? <ResultsPanel result={result} currentFile={currentFile} allFindings={allFindings} activeFinding={activeFinding} explanation={explanation} detailTab={detailTab} setDetailTab={setDetailTab} setActiveFile={setActiveFile} explainFinding={explainFinding} copied={copied} copyCode={copyCode} exportMarkdown={exportMarkdown} exportJson={exportJson} exportDiff={exportDiff} exportPatch={exportPatch} /> : <EmptyPanel status={status} />}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function ProgressPanel({ progressIndex }: { progressIndex: number }) {
  return <div className="flex flex-1 flex-col justify-center"><div className="mb-8 flex items-center justify-between"><div><p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-brand-orange">Live migration run</p><h3 className="mt-1 font-display text-xl font-extrabold tracking-[-0.03em] text-ink-primary">{progressStages[progressIndex]}</h3></div><Loader2 className="animate-spin text-brand-orange" size={20} /></div><div className="space-y-3">{progressStages.map((stage, index) => <div className="flex items-center gap-3" key={stage}><span className={`grid h-6 w-6 place-items-center rounded-full border ${index < progressIndex ? 'border-status bg-status/10 text-status' : index === progressIndex ? 'border-brand-orange bg-brand-orange/10 text-brand-orange' : 'border-line text-ink-subtle'}`}>{index < progressIndex ? <Check size={13} /> : index === progressIndex ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-orange" /> : <span className="text-[0.625rem]">{index + 1}</span>}</span><span className={`text-sm ${index <= progressIndex ? 'text-ink-primary' : 'text-ink-subtle'}`}>{stage}</span></div>)}</div><p className="mt-8 text-xs text-ink-muted">LUME performs static analysis and syntax verification only. Your code is never executed.</p></div>;
}

function EmptyPanel({ status }: { status: WorkspaceStatus }) {
  return <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface-base/40 px-7 text-center"><span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface-elevated text-ink-subtle">{status === 'error' ? <AlertCircle size={25} /> : <FileText size={25} />}</span><p className="font-display text-sm font-bold text-ink-primary">{status === 'error' ? 'Migration needs attention' : 'Your migration summary will appear here'}</p><p className="mt-2 max-w-sm text-xs leading-5 text-ink-muted">LUME analyzes the source, applies deterministic rules, and syntax-checks each transformed file.</p></div>;
}

interface ResultsProps { result: MigrationResponse; currentFile?: ScannedFile; allFindings: Finding[]; activeFinding: Finding | null; explanation: Explanation | null; detailTab: DetailTab; setDetailTab: (tab: DetailTab) => void; setActiveFile: (index: number) => void; explainFinding: (finding: Finding) => void; copied: boolean; copyCode: () => void; exportMarkdown: () => void; exportJson: () => void; exportDiff: () => void; exportPatch: () => void }

function ResultsPanel({ result, currentFile, allFindings, activeFinding, explanation, detailTab, setDetailTab, setActiveFile, explainFinding, copied, copyCode, exportMarkdown, exportJson, exportDiff, exportPatch }: ResultsProps) {
  const summary = result.report.summary; const verification = result.verification;
  const tabs: Array<{ id: DetailTab; label: string; icon: typeof FileText }> = [{ id: 'findings', label: 'Findings', icon: AlertCircle }, { id: 'diff', label: 'Diff viewer', icon: GitCompare }, { id: 'verification', label: 'Verification', icon: ShieldCheck }, { id: 'export', label: 'Export center', icon: Download }];
  const metrics = [{ label: 'Files scanned', value: summary.total_files_scanned, icon: FileCode2 }, { label: 'Findings', value: summary.total_findings, icon: AlertCircle }, { label: 'Readiness', value: summary.readiness_score + '%', icon: Sparkles }, { label: 'Verified', value: verification.verified_files + '/' + verification.total_files, icon: ShieldCheck }];
  return <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-status">Migration complete</p><h3 className="mt-1 font-display text-xl font-extrabold tracking-[-0.03em] text-ink-primary">Repository ready for review.</h3></div><div className="flex items-center gap-2 rounded-full border border-status/25 bg-status/5 px-3 py-1.5 text-xs font-semibold text-status"><CheckCircle2 size={14} /> {verification.all_valid ? 'Syntax verified' : 'Review required'}</div></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{metrics.map((metric, index) => { const Icon = metric.icon; return <motion.div className="group rounded-xl border border-line bg-surface-base/70 p-3 shadow-panel transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-brand-orange/50 hover:shadow-glow-primary" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1, duration: 0.5, ease: 'easeOut' }} key={metric.label}><div className="flex items-center justify-between"><p className="font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-ink-subtle">{metric.label}</p><Icon aria-hidden="true" className="text-brand-orange transition-transform duration-300 group-hover:translate-y-[-1px]" size={15} /></div><p className="mt-2 font-display text-xl font-extrabold text-ink-primary">{metric.value}</p></motion.div>; })}</div>
    <div className="flex gap-1 overflow-x-auto border-b border-line pb-1">{tabs.map((tab) => { const Icon = tab.icon; return <button className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${detailTab === tab.id ? 'bg-surface-elevated text-brand-orange' : 'text-ink-subtle hover:text-ink-primary'}`} key={tab.id} onClick={() => setDetailTab(tab.id)} type="button"><Icon size={14} />{tab.label}</button>; })}</div>
    {detailTab === 'findings' && <FindingsView result={result} allFindings={allFindings} activeFinding={activeFinding} explanation={explanation} setActiveFile={setActiveFile} explainFinding={explainFinding} />}
    {detailTab === 'diff' && <DiffView result={result} currentFile={currentFile} setActiveFile={setActiveFile} copyCode={copyCode} copied={copied} />}
    {detailTab === 'verification' && <VerificationView result={result} />}
    {detailTab === 'export' && <ExportView exportMarkdown={exportMarkdown} exportJson={exportJson} exportDiff={exportDiff} exportPatch={exportPatch} currentFile={currentFile} copyCode={copyCode} copied={copied} />}
  </div>;
}

function FilePicker({ result, setActiveFile }: { result: MigrationResponse; setActiveFile: (index: number) => void }) { return <select className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 text-xs text-ink-primary outline-none" onChange={(event) => setActiveFile(Number(event.target.value))}>{result.files.map((file, index) => <option key={file.file_path} value={index}>{file.file_path}</option>)}</select>; }

function FindingsView({ result, allFindings, activeFinding, explanation, setActiveFile, explainFinding }: { result: MigrationResponse; allFindings: Finding[]; activeFinding: Finding | null; explanation: Explanation | null; setActiveFile: (index: number) => void; explainFinding: (finding: Finding) => void }) {
  return <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]"><div className="space-y-2"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold text-ink-primary">{allFindings.length} migration findings</p><span className="font-mono text-[0.625rem] text-ink-subtle">Click to inspect</span></div>{allFindings.length ? allFindings.map((finding, index) => { const active = activeFinding?.id === finding.id; return <motion.button animate={{ opacity: 1, y: 0 }} className={'w-full rounded-xl border p-3 text-left transition-[transform,box-shadow,border-color,background-color] duration-300 hover:-translate-y-0.5 hover:border-brand-orange/50 hover:shadow-glow-primary ' + (active ? 'border-brand-orange/60 bg-brand-orange/5' : 'border-line bg-surface-base/40')} initial={{ opacity: 0, y: 18 }} key={finding.id} onClick={() => { const fileIndex = result.files.findIndex((file) => file.file_path === finding.file_path); if (fileIndex >= 0) setActiveFile(fileIndex); explainFinding(finding); }} transition={{ delay: index * 0.1, duration: 0.5, ease: 'easeOut' }} type="button"><div className="flex items-start justify-between gap-3"><span className="font-mono text-[0.625rem] text-brand-orange">{finding.file_path}:{finding.line_number}</span><span className="rounded-full border border-line px-2 py-0.5 font-mono text-[0.5625rem] text-ink-muted">{finding.severity}</span></div><p className="mt-1 text-xs font-bold text-ink-primary">{finding.rule_name}</p><p className="mt-1 truncate font-mono text-[0.625rem] text-ink-muted">{finding.code_snippet}</p></motion.button>; }) : <div className="rounded-xl border border-status/25 bg-status/5 p-4 text-xs text-status">No migration findings detected in the scanned files.</div>}</div><div className="rounded-xl border border-line bg-surface-base/50 p-4">{activeFinding ? <><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-brand-orange">Finding detail</p><h4 className="mt-1 text-sm font-bold text-ink-primary">{activeFinding.rule_name}</h4></div><Sparkles className="text-brand-orange" size={16} /></div><div className="mt-4 space-y-3 text-xs"><div><p className="font-mono text-[0.5625rem] uppercase text-ink-subtle">Legacy API</p><code className="mt-1 block rounded-lg bg-surface-base p-2 text-brand-orange">{activeFinding.code_snippet}</code></div><div><p className="font-mono text-[0.5625rem] uppercase text-ink-subtle">Suggested migration</p><code className="mt-1 block rounded-lg bg-surface-base p-2 text-status">{activeFinding.suggested_replacement}</code></div><p className="leading-5 text-ink-muted">{activeFinding.why_changed}</p><p className="leading-5 text-ink-muted">{activeFinding.migration_advice}</p>{explanation && <div className="border-t border-line pt-3"><p className="font-mono text-[0.5625rem] uppercase text-brand-orange">{explanation.ai_generated ? 'AI explanation' : 'Deterministic explanation'}</p><p className="mt-1 font-semibold text-ink-primary">{explanation.summary}</p><p className="mt-1 leading-5 text-ink-muted">{explanation.rationale}</p><ul className="mt-2 space-y-1 text-ink-muted">{explanation.migration_steps.map((step) => <li key={step}>• {step}</li>)}</ul></div>}</div></> : <div className="flex min-h-48 items-center justify-center text-center text-xs text-ink-muted">Select a finding to inspect its migration reasoning.</div>}</div></div>;
}

function DiffView({ result, currentFile, setActiveFile, copyCode, copied }: { result: MigrationResponse; currentFile?: ScannedFile; setActiveFile: (index: number) => void; copyCode: () => void; copied: boolean }) {
  const originalLines = currentFile?.original_code.split(/\r?\n/) ?? [];
  const transformedLines = currentFile?.transformed_code.split(/\r?\n/) ?? [];

  return <div className="space-y-3"><FilePicker result={result} setActiveFile={setActiveFile} /><div className="flex items-center justify-between"><div className="flex gap-4 font-mono text-[0.625rem] uppercase tracking-[0.12em]"><span className="text-brand-orange">v0.x legacy</span><span className="text-status">v1.x migrated</span></div><button className="flex items-center gap-1 text-xs font-bold text-ink-muted transition-colors hover:text-brand-orange" onClick={copyCode} type="button">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy migrated'}</button></div><div className="grid max-h-96 min-h-56 grid-cols-1 gap-px overflow-auto rounded-xl border border-line bg-line md:grid-cols-2"><CodePaneLines lines={originalLines} counterpart={transformedLines} tone="legacy" /><CodePaneLines lines={transformedLines} counterpart={originalLines} tone="modern" /></div><details className="rounded-xl border border-line bg-surface-base/40 p-3"><summary className="flex cursor-pointer items-center gap-2 text-xs font-bold text-ink-primary"><ChevronDown size={14} /> Unified diff</summary><pre className="mt-3 overflow-auto font-mono text-[0.625rem] leading-5 text-ink-muted">{currentFile?.diff_text || 'No changes generated.'}</pre></details></div>;
}

function CodePaneLines({ lines, counterpart, tone }: { lines: string[]; counterpart: string[]; tone: 'legacy' | 'modern' }) {
  return <div className="overflow-auto bg-surface-base p-3 font-mono text-[0.625rem] leading-5"><div className="mb-2 flex items-center justify-between border-b border-line pb-2 text-[0.5625rem] uppercase tracking-[0.14em] text-ink-subtle"><span>{tone === 'legacy' ? 'Legacy source' : 'Migrated source'}</span><span>{tone === 'legacy' ? 'removed' : 'added'}</span></div>{lines.map((line, index) => { const changed = !counterpart.includes(line); return <div className={'flex min-w-max gap-3 px-2 ' + (changed ? tone === 'legacy' ? 'bg-brand-red/10 text-brand-orange' : 'bg-status/10 text-status' : 'text-ink-muted')} key={line + index}><span className="w-6 select-none text-right text-ink-subtle/60">{index + 1}</span><code>{highlightCode(line)}</code></div>; })}</div>;
}

function highlightCode(line: string) {
  const tokens = line.split(/(\b(?:import|from|as|def|class|return|try|except|with|for|in|if|else)\b|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|#.*$)/g);
  return tokens.map((token, index) => {
    const isKeyword = /^(import|from|as|def|class|return|try|except|with|for|in|if|else)$/.test(token);
    const isString = /^(["']).*\1$/.test(token);
    const isComment = token.startsWith('#');
    return <span className={isKeyword ? 'text-brand-orange' : isString ? 'text-brand-ember' : isComment ? 'text-ink-subtle' : undefined} key={token + index}>{token}</span>;
  });
}

function VerificationView({ result }: { result: MigrationResponse }) { const { verification } = result; return <div className="space-y-3"><div className={`rounded-xl border p-4 ${verification.all_valid ? 'border-status/30 bg-status/5' : 'border-brand-orange/30 bg-brand-orange/5'}`}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-bold text-ink-primary"><ShieldCheck className={verification.all_valid ? 'text-status' : 'text-brand-orange'} size={18} />{verification.all_valid ? 'Syntax verification passed' : 'Syntax verification needs review'}</div><span className="font-mono text-xs text-ink-muted">{verification.verified_files} verified Â· {verification.failed_files} failed</span></div><p className="mt-2 text-xs leading-5 text-ink-muted">Verification is syntax-only. LUME does not import or execute user code, so semantic correctness is not assessed.</p></div>{result.files.map((file) => <div className="flex items-start justify-between gap-4 border-b border-line py-3 text-xs" key={file.file_path}><span className="font-mono text-ink-muted">{file.file_path}</span><span className={file.verification.valid ? 'text-status' : 'text-brand-orange'}>{file.verification.valid ? 'âœ“ Syntax Valid' : `âœ• ${file.verification.error_message || 'Syntax Invalid'}`}</span></div>)}</div>; }

function ExportView({ exportMarkdown, exportJson, exportDiff, exportPatch, currentFile, copyCode, copied }: { exportMarkdown: () => void; exportJson: () => void; exportDiff: () => void; exportPatch: () => void; currentFile?: ScannedFile; copyCode: () => void; copied: boolean }) { const actions = [{ label: 'Download Markdown Report', icon: FileText, action: exportMarkdown }, { label: 'Download JSON Report', icon: FileCode2, action: exportJson }, { label: 'Download Unified Diff', icon: GitCompare, action: exportDiff }, { label: 'Download Patch File', icon: Download, action: exportPatch }, { label: copied ? 'Copied Updated Code' : 'Copy Updated Code', icon: copied ? Check : Clipboard, action: copyCode }]; return <div className="grid gap-2 sm:grid-cols-2">{actions.map((item, index) => { const Icon = item.icon; return <motion.button animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between rounded-xl border border-line bg-surface-base/50 p-4 text-left text-xs font-bold text-ink-primary transition-[transform,box-shadow,border-color,background-color] duration-300 hover:-translate-y-1 hover:border-brand-orange/50 hover:bg-brand-orange/5 hover:shadow-glow-primary" initial={{ opacity: 0, y: 18 }} key={item.label} onClick={item.action} transition={{ delay: index * 0.1, duration: 0.5, ease: 'easeOut' }} type="button"><span className="flex items-center gap-3"><Icon className="text-brand-orange transition-transform duration-300 group-hover:translate-x-0.5" size={17} />{item.label}</span><ArrowRight className="text-ink-subtle" size={15} /></motion.button>; })}<div className="sm:col-span-2"><p className="mt-3 flex items-center gap-2 text-xs text-status"><CheckCircle2 size={14} /> Report ready for handoff</p><p className="mt-1 text-xs text-ink-muted">{currentFile ? 'Exports contain the transformed source and deterministic scan results.' : 'Run a migration to generate exports.'}</p></div></div>; }

