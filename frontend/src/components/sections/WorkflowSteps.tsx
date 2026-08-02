import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
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
  LayoutDashboard,
  Loader2,
  Menu,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  WandSparkles,
} from 'lucide-react';
import { BrandMark } from '../ui/BrandMark';

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
    setActiveFinding(finding); setExplanation(null);
    try {
      const response = await fetch(`${API}/explain`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ finding }) });
      if (response.ok) setExplanation((await response.json()) as Explanation);
    } catch { /* Deterministic finding details remain available if optional explanation fails. */ }
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

  const resetWorkspace = () => {
    setMode('zip'); setSelectedFile(null); setCode(''); setStatus('idle'); setResult(null); setError(null); setActiveFinding(null); setExplanation(null); setDetailTab('findings');
  };

  const openUploadDialog = () => document.getElementById('repository-upload')?.click();

  return (
    <section aria-labelledby="workspace-title" className="min-h-screen bg-[#07080c] text-ink-primary" id="workflow">
      <div className="mx-auto flex min-h-screen max-w-[112rem] lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <WorkspaceSidebar onNewMigration={resetWorkspace} onUpload={openUploadDialog} />

        <main className="min-w-0 px-4 pb-10 pt-4 sm:px-6 lg:px-8 lg:pt-7">
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[0.6875rem] font-semibold text-ink-subtle"><span>Workspace</span><span className="text-ink-subtle/40">/</span><span className="text-brand-orange">Migration center</span></div>
              <h1 className="font-display text-2xl font-extrabold tracking-[-0.045em] text-ink-primary sm:text-3xl" id="workspace-title">Good morning, let&apos;s migrate.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">Analyze your repository, review deterministic findings, and ship an upgrade with confidence.</p>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <button aria-label="Workspace settings" className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface-panel text-ink-muted transition-colors hover:border-brand-orange/50 hover:text-ink-primary" type="button"><Settings2 size={17} /></button>
              <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand-orange/60 bg-brand-gradient px-3.5 text-xs font-extrabold text-ink-primary shadow-glow-primary transition-transform hover:-translate-y-0.5" onClick={resetWorkspace} type="button"><Plus size={15} />New migration</button>
            </div>
            <button aria-label="Open workspace menu" className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface-panel text-ink-muted sm:hidden" type="button"><Menu size={18} /></button>
          </div>

          <StatsStrip result={result} />

          <div className="mt-5 grid gap-5 xl:grid-cols-12">
            <SourcePanel className="xl:col-span-4" code={code} error={error} hasInput={hasInput} mode={mode} samples={samples} selectedFile={selectedFile} selectedSampleId={selectedSampleId} setCode={(value) => { setCode(value); setError(null); setResult(null); }} setMode={(value) => { setMode(value); setError(null); }} setSelectedSampleId={setSelectedSampleId} setZipFile={setZipFile} handleDrop={handleDrop} loadSampleRepository={loadSampleRepository} startMigration={startMigration} status={status} />
            <EditorPanel className="xl:col-span-8" copied={copied} copyCode={copyCode} currentFile={currentFile} result={result} setActiveFile={setActiveFile} status={status} progressIndex={progressIndex} />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-12">
            <AnalysisRegion className="xl:col-span-8" activeFinding={activeFinding} allFindings={allFindings} copied={copied} copyCode={copyCode} currentFile={currentFile} detailTab={detailTab} explanation={explanation} exportDiff={exportDiff} exportJson={exportJson} exportMarkdown={exportMarkdown} exportPatch={exportPatch} explainFinding={explainFinding} result={result} setActiveFile={setActiveFile} setDetailTab={setDetailTab} status={status} />
            <QuickActionsPanel className="xl:col-span-4" exportMarkdown={exportMarkdown} hasResult={Boolean(result)} loadSampleRepository={loadSampleRepository} onNewMigration={resetWorkspace} onUpload={openUploadDialog} />
          </div>
        </main>
      </div>
    </section>
  );
}

function WorkspaceSidebar({ onNewMigration, onUpload }: { onNewMigration: () => void; onUpload: () => void }) {
  const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <aside className="hidden border-r border-line bg-[#090a0f] px-4 py-6 lg:flex lg:flex-col">
      <div className="flex items-center gap-2.5 px-2"><BrandMark className="h-8 w-8" /><span className="font-display text-lg font-extrabold tracking-[0.14em]">LUME</span></div>
      <div className="mt-10 px-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-ink-subtle">Workspace</div>
      <nav className="mt-3 space-y-1" aria-label="Workspace navigation">
        <SidebarItem active icon={LayoutDashboard} label="Overview" onClick={() => jumpTo('workspace-title')} />
        <SidebarItem icon={GitCompare} label="Migration" onClick={() => jumpTo('source-panel')} />
        <SidebarItem icon={AlertTriangle} label="Findings" onClick={() => jumpTo('analysis-panel')} />
        <SidebarItem icon={WandSparkles} label="AI assistant" onClick={() => jumpTo('explanation-panel')} />
      </nav>
      <div className="mt-8 px-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-ink-subtle">Shortcuts</div>
      <div className="mt-3 space-y-1">
        <SidebarItem icon={Upload} label="Upload repository" onClick={onUpload} />
        <SidebarItem icon={Plus} label="New migration" onClick={onNewMigration} />
      </div>
      <div className="mt-auto rounded-2xl border border-line bg-surface-panel p-3.5 shadow-panel">
        <div className="flex items-center justify-between"><span className="text-xs font-bold text-ink-primary">Migration engine</span><span className="flex items-center gap-1.5 font-mono text-[0.6rem] text-status"><span className="h-1.5 w-1.5 rounded-full bg-status shadow-[0_0_0.6rem_var(--status-online)]" />Online</span></div>
        <p className="mt-2 text-[0.6875rem] leading-5 text-ink-muted">Local analysis is ready. Your source stays in your control.</p>
      </div>
    </aside>
  );
}

function SidebarItem({ active, icon: Icon, label, onClick }: { active?: boolean; icon: typeof LayoutDashboard; label: string; onClick: () => void }) {
  return <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-colors ${active ? 'bg-brand-orange/10 text-brand-orange shadow-[inset_2px_0_0_var(--brand-orange)]' : 'text-ink-muted hover:bg-surface-elevated hover:text-ink-primary'}`} onClick={onClick} type="button"><Icon size={16} /><span>{label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-orange" />}</button>;
}

function StatsStrip({ result }: { result: MigrationResponse | null }) {
  const summary = result?.report.summary;
  const metrics = [
    { label: 'Files scanned', value: summary?.total_files_scanned ?? 0, note: result ? 'Latest scan' : 'Awaiting scan', icon: FileCode2, color: 'text-brand-orange' },
    { label: 'Findings', value: summary?.total_findings ?? 0, note: result ? `${summary?.manual_review_count ?? 0} need review` : 'No findings yet', icon: AlertTriangle, color: 'text-[#ffbf69]' },
    { label: 'Readiness score', value: summary ? `${summary.readiness_score}%` : '--', note: result ? 'Migration readiness' : 'Run a migration', icon: Activity, color: 'text-[#8ac7ff]' },
    { label: 'Verified files', value: result ? `${result.verification.verified_files}/${result.verification.total_files}` : '--', note: result ? (result.verification.all_valid ? 'All checks passed' : 'Review required') : 'Syntax checks', icon: ShieldCheck, color: 'text-status' },
  ];
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map((metric) => { const Icon = metric.icon; return <div className="rounded-2xl border border-line bg-surface-panel px-4 py-4 shadow-panel sm:px-5" key={metric.label}><div className="flex items-center justify-between gap-2"><span className="text-[0.6875rem] font-semibold text-ink-muted">{metric.label}</span><Icon className={metric.color} size={16} /></div><div className="mt-3 flex items-end justify-between gap-2"><span className="font-display text-2xl font-extrabold tracking-[-0.04em] text-ink-primary">{metric.value}</span><span className="hidden text-right text-[0.6rem] text-ink-subtle sm:block">{metric.note}</span></div></div>; })}</div>;
}

interface SourcePanelProps {
  className?: string;
  code: string;
  error: string | null;
  hasInput: boolean;
  mode: SourceMode;
  samples: SampleRepository[];
  selectedFile: File | null;
  selectedSampleId: string | null;
  setCode: (value: string) => void;
  setMode: (value: SourceMode) => void;
  setSelectedSampleId: (value: string) => void;
  setZipFile: (file: File | undefined) => void;
  handleDrop: (event: DragEvent<HTMLLabelElement>) => void;
  loadSampleRepository: () => void;
  startMigration: () => void;
  status: WorkspaceStatus;
}

function SourcePanel({ className = '', code, error, hasInput, mode, samples, selectedFile, selectedSampleId, setCode, setMode, setSelectedSampleId, setZipFile, handleDrop, loadSampleRepository, startMigration, status }: SourcePanelProps) {
  const tabs = [{ id: 'zip' as const, label: 'ZIP', icon: Upload }, { id: 'paste' as const, label: 'Paste', icon: Code2 }, { id: 'sample' as const, label: 'Sample', icon: FolderOpen }];
  return <PanelCard className={className} eyebrow="Source" id="source-panel" title="Start a migration" description="Choose a source to analyze with the migration engine." action={<span className="flex items-center gap-1.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-status"><span className="h-1.5 w-1.5 rounded-full bg-status" />Local</span>}>
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-base p-1">{tabs.map((tab) => { const Icon = tab.icon; const active = mode === tab.id; return <button aria-pressed={active} className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-[0.6875rem] font-extrabold transition-colors ${active ? 'bg-surface-elevated text-ink-primary shadow-panel' : 'text-ink-subtle hover:text-ink-primary'}`} key={tab.id} onClick={() => setMode(tab.id)} type="button"><Icon size={14} />{tab.label}</button>; })}</div>
    {mode === 'zip' && <label className="mt-4 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-brand-orange/45 bg-brand-orange/[0.04] px-5 text-center transition-colors hover:border-brand-orange hover:bg-brand-orange/[0.08]" htmlFor="repository-upload" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}><input accept=".zip,application/zip" className="sr-only" id="repository-upload" onChange={(event) => setZipFile(event.target.files?.[0])} type="file" /><span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-brand-orange/30 bg-brand-orange/10 text-brand-orange"><Upload size={20} /></span><span className="max-w-full truncate text-sm font-extrabold text-ink-primary">{selectedFile ? selectedFile.name : 'Drop repository ZIP'}</span><span className="mt-1 text-xs text-ink-muted">{selectedFile ? 'Ready to analyze' : 'or browse from your computer'}</span></label>}
    {mode === 'paste' && <label className="mt-4 block" htmlFor="code-input"><span className="sr-only">Paste Python code</span><textarea className="min-h-48 w-full resize-y rounded-2xl border border-line bg-surface-base px-4 py-3 font-mono text-xs leading-6 text-ink-primary outline-none placeholder:text-ink-subtle focus:border-brand-orange/70 focus:ring-2 focus:ring-brand-orange/20" id="code-input" onChange={(event) => setCode(event.target.value)} placeholder={'import openai\n\nresponse = openai.ChatCompletion.create(...)'} value={code} /></label>}
    {mode === 'sample' && <div className="mt-4 flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-brand-orange/35 bg-brand-orange/[0.04] px-5 text-center"><span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-brand-orange/30 bg-brand-orange/10 text-brand-orange"><FolderOpen size={20} /></span><p className="text-sm font-extrabold text-ink-primary">Bundled sample repository</p><p className="mt-1 max-w-xs text-xs leading-5 text-ink-muted">Use an included example to preview a complete migration.</p>{samples.length > 0 && <select className="mt-4 w-full rounded-xl border border-line bg-surface-base px-3 py-2 text-xs font-semibold text-ink-primary outline-none" onChange={(event) => setSelectedSampleId(event.target.value)} value={selectedSampleId ?? ''}>{samples.map((sample) => <option key={sample.id} value={sample.id}>{sample.name}</option>)}</select>}<button className="mt-3 text-xs font-bold text-brand-orange underline-offset-4 hover:underline" onClick={loadSampleRepository} type="button">Load sample repositories</button></div>}
    {error && <p className="mt-3 flex items-center gap-2 text-xs leading-5 text-brand-orange" role="alert"><AlertCircle size={14} />{error}</p>}
    <div className="mt-4 flex items-center justify-between gap-3"><span className="text-[0.6875rem] text-ink-subtle">Supports .zip and Python snippets</span><button className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand-orange/70 bg-brand-gradient px-3.5 text-xs font-extrabold text-ink-primary shadow-glow-primary transition-transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40" disabled={status === 'loading' || !hasInput} onClick={startMigration} type="button">{status === 'loading' ? <Loader2 className="animate-spin" size={15} /> : <Play size={14} />}{status === 'loading' ? 'Analyzing' : 'Start scan'}</button></div>
  </PanelCard>;
}

function EditorPanel({ className = '', copied, copyCode, currentFile, result, setActiveFile, status, progressIndex }: { className?: string; copied: boolean; copyCode: () => void; currentFile?: ScannedFile; result: MigrationResponse | null; setActiveFile: (index: number) => void; status: WorkspaceStatus; progressIndex: number }) {
  return <PanelCard className={className} eyebrow="Editor" id="editor-panel" title="Migration workspace" description={currentFile?.file_path || 'Your migrated source will appear here after a scan.'} action={result ? <FilePicker result={result} setActiveFile={setActiveFile} /> : <span className="rounded-md border border-line bg-surface-base px-2 py-1 font-mono text-[0.58rem] text-ink-subtle">PYTHON</span>}>
    <div className="overflow-hidden rounded-2xl border border-line bg-[#05060a] shadow-[inset_0_1px_0_rgb(255_255_255_/_3%)]">
      <div className="flex min-h-11 items-center justify-between border-b border-line bg-surface-base/70 px-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand-orange shadow-[0_0_0.6rem_var(--brand-orange)]" /><span className="font-mono text-[0.62rem] text-ink-muted">{currentFile?.file_path || 'migration_preview.py'}</span></div><div className="flex items-center gap-1.5"><span className="hidden font-mono text-[0.58rem] text-ink-subtle sm:inline">TRANSFORMED OUTPUT</span>{result && <button aria-label={copied ? 'Copied migrated code' : 'Copy migrated code'} className="grid h-7 w-7 place-items-center rounded-md text-ink-subtle hover:bg-surface-elevated hover:text-brand-orange" onClick={copyCode} type="button">{copied ? <Check size={14} /> : <Copy size={14} />}</button>}</div></div>
      {status === 'loading' ? <ProgressPanel progressIndex={progressIndex} /> : currentFile ? <CodeEditor code={currentFile.transformed_code} tone="modern" /> : <EmptyEditor status={status} />}
    </div>
  </PanelCard>;
}

function CodeEditor({ code, tone }: { code: string; tone: 'legacy' | 'modern' }) {
  const lines = code.split(/\r?\n/);
  return <div className="grid min-h-[22rem] grid-cols-[2.75rem_minmax(0,1fr)] overflow-auto bg-[#05060a] py-4 font-mono text-[0.7rem] leading-6"><div className="select-none border-r border-line px-3 text-right text-ink-subtle/50">{lines.map((_, index) => <div key={index}>{index + 1}</div>)}</div><pre className={`min-w-max px-5 ${tone === 'modern' ? 'text-ink-muted' : 'text-ink-subtle'}`}>{lines.map((line, index) => <code className="block" key={`${line}-${index}`}>{highlightCode(line)}</code>)}</pre></div>;
}

function EmptyEditor({ status }: { status: WorkspaceStatus }) {
  return <div className="flex min-h-[22rem] flex-col items-center justify-center px-8 text-center"><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface-elevated text-ink-subtle"><Code2 size={22} /></div><p className="text-sm font-extrabold text-ink-primary">{status === 'error' ? 'Scan could not be completed' : 'Editor ready for your migration'}</p><p className="mt-2 max-w-sm text-xs leading-5 text-ink-muted">Start a scan from the source panel and LUME will show the transformed output with line-level context here.</p><div className="mt-5 flex items-center gap-2 font-mono text-[0.6rem] text-ink-subtle"><span className="h-1.5 w-1.5 rounded-full bg-ink-subtle/60" />No active file</div></div>;
}

function AnalysisRegion({ className = '', activeFinding, allFindings, copied, copyCode, currentFile, detailTab, explanation, exportDiff, exportJson, exportMarkdown, exportPatch, explainFinding, result, setActiveFile, setDetailTab, status }: { className?: string; activeFinding: Finding | null; allFindings: Finding[]; copied: boolean; copyCode: () => void; currentFile?: ScannedFile; detailTab: DetailTab; explanation: Explanation | null; exportDiff: () => void; exportJson: () => void; exportMarkdown: () => void; exportPatch: () => void; explainFinding: (finding: Finding) => void; result: MigrationResponse | null; setActiveFile: (index: number) => void; setDetailTab: (tab: DetailTab) => void; status: WorkspaceStatus }) {
  return <PanelCard className={className} eyebrow="Analysis" id="analysis-panel" title={result ? 'Review migration output' : 'Findings and migration preview'} description={result ? 'Inspect every change before you export the migration.' : 'Your findings, preview, and explanation will appear here.'} action={result ? <span className="flex items-center gap-1.5 text-[0.62rem] font-bold text-status"><CheckCircle2 size={14} />{result.verification.all_valid ? 'Verified' : 'Review required'}</span> : undefined}>
    <div className="flex gap-1 overflow-x-auto border-b border-line pb-2">{([{ id: 'findings', label: 'Findings', icon: AlertTriangle }, { id: 'diff', label: 'Migration preview', icon: GitCompare }, { id: 'verification', label: 'Verification', icon: ShieldCheck }, { id: 'export', label: 'Quick export', icon: Download }] as const).map((tab) => { const Icon = tab.icon; return <button aria-pressed={detailTab === tab.id} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[0.67rem] font-extrabold transition-colors ${detailTab === tab.id ? 'bg-brand-orange/10 text-brand-orange' : 'text-ink-subtle hover:text-ink-primary'}`} key={tab.id} onClick={() => setDetailTab(tab.id)} type="button"><Icon size={14} />{tab.label}</button>; })}</div>
    {!result || status === 'idle' && !result ? <EmptyAnalysis /> : detailTab === 'findings' ? <DefaultAnalysis activeFinding={activeFinding} allFindings={allFindings} explanation={explanation} explainFinding={explainFinding} result={result!} setActiveFile={setActiveFile} /> : detailTab === 'diff' ? <MigrationPreview currentFile={currentFile} copyCode={copyCode} copied={copied} result={result!} setActiveFile={setActiveFile} /> : detailTab === 'verification' ? <VerificationView result={result!} /> : <ExportView copied={copied} copyCode={copyCode} currentFile={currentFile} exportDiff={exportDiff} exportJson={exportJson} exportMarkdown={exportMarkdown} exportPatch={exportPatch} />}
  </PanelCard>;
}

function EmptyAnalysis() {
  return <div className="grid gap-3 pt-4 md:grid-cols-3"><EmptyMiniPanel icon={AlertTriangle} title="Findings" copy="Run a scan to see deterministic migration rules." /><EmptyMiniPanel icon={GitCompare} title="Migration preview" copy="Compare legacy and transformed source side by side." /><EmptyMiniPanel icon={WandSparkles} title="AI explanation" copy="Ask for a plain-language explanation of each finding." /></div>;
}

function EmptyMiniPanel({ icon: Icon, title, copy }: { icon: typeof AlertTriangle; title: string; copy: string }) {
  return <div className="rounded-xl border border-dashed border-line bg-surface-base/35 p-4"><Icon className="text-ink-subtle" size={17} /><p className="mt-4 text-xs font-extrabold text-ink-primary">{title}</p><p className="mt-1 text-[0.68rem] leading-5 text-ink-muted">{copy}</p></div>;
}

function DefaultAnalysis({ activeFinding, allFindings, explanation, explainFinding, result, setActiveFile }: { activeFinding: Finding | null; allFindings: Finding[]; explanation: Explanation | null; explainFinding: (finding: Finding) => void; result: MigrationResponse; setActiveFile: (index: number) => void }) {
  return <div className="space-y-4 pt-4"><div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]"><FindingsList activeFinding={activeFinding} allFindings={allFindings} explainFinding={explainFinding} result={result} setActiveFile={setActiveFile} /><FindingDetail activeFinding={activeFinding} /></div><AiExplanationPanel activeFinding={activeFinding} explanation={explanation} /></div>;
}

function FindingsList({ activeFinding, allFindings, explainFinding, result, setActiveFile }: { activeFinding: Finding | null; allFindings: Finding[]; explainFinding: (finding: Finding) => void; result: MigrationResponse; setActiveFile: (index: number) => void }) {
  return <div><div className="mb-3 flex items-center justify-between"><span className="text-xs font-extrabold text-ink-primary">{allFindings.length} migration findings</span><span className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-ink-subtle">Select to inspect</span></div><div className="max-h-[20rem] space-y-2 overflow-auto pr-1">{allFindings.length ? allFindings.map((finding) => { const active = activeFinding?.id === finding.id; return <button className={`w-full rounded-xl border p-3 text-left transition-colors ${active ? 'border-brand-orange/60 bg-brand-orange/[0.07]' : 'border-line bg-surface-base/45 hover:border-brand-orange/40 hover:bg-surface-elevated'}`} key={finding.id} onClick={() => { const fileIndex = result.files.findIndex((file) => file.file_path === finding.file_path); if (fileIndex >= 0) setActiveFile(fileIndex); explainFinding(finding); }} type="button"><div className="flex items-start justify-between gap-3"><span className="font-mono text-[0.6rem] text-brand-orange">{finding.file_path}:{finding.line_number}</span><SeverityBadge severity={finding.severity} /></div><p className="mt-1 text-xs font-extrabold text-ink-primary">{finding.rule_name}</p><p className="mt-1 truncate font-mono text-[0.6rem] text-ink-muted">{finding.code_snippet}</p></button>; }) : <div className="rounded-xl border border-status/25 bg-status/5 p-4 text-xs text-status">No migration findings detected in the scanned files.</div>}</div></div>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const label = severity || 'review';
  const tone = label.toLowerCase() === 'critical' || label.toLowerCase() === 'high' ? 'border-brand-red/30 bg-brand-red/10 text-brand-orange' : label.toLowerCase() === 'low' ? 'border-status/25 bg-status/5 text-status' : 'border-[#ffbf69]/30 bg-[#ffbf69]/10 text-[#ffbf69]';
  return <span className={`rounded-md border px-1.5 py-0.5 font-mono text-[0.55rem] uppercase ${tone}`}>{label}</span>;
}

function FindingDetail({ activeFinding }: { activeFinding: Finding | null }) {
  if (!activeFinding) return <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-base/35 px-6 text-center"><Search className="text-ink-subtle" size={19} /><p className="mt-3 text-xs font-extrabold text-ink-primary">Select a finding to inspect</p><p className="mt-1 max-w-xs text-[0.68rem] leading-5 text-ink-muted">Review the legacy call, suggested replacement, and migration guidance.</p></div>;
  return <div className="rounded-xl border border-line bg-surface-base/55 p-4"><div className="flex items-start justify-between gap-3"><div><span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-brand-orange">Finding detail</span><h3 className="mt-1 text-sm font-extrabold text-ink-primary">{activeFinding.rule_name}</h3></div><SeverityBadge severity={activeFinding.severity} /></div><div className="mt-4 space-y-3 text-xs"><div><p className="font-mono text-[0.57rem] uppercase tracking-[0.12em] text-ink-subtle">Legacy API</p><code className="mt-1 block overflow-auto rounded-lg bg-[#05060a] p-2.5 font-mono text-[0.67rem] text-brand-orange">{activeFinding.code_snippet}</code></div><div><p className="font-mono text-[0.57rem] uppercase tracking-[0.12em] text-ink-subtle">Suggested migration</p><code className="mt-1 block overflow-auto rounded-lg bg-[#05060a] p-2.5 font-mono text-[0.67rem] text-status">{activeFinding.suggested_replacement}</code></div><p className="leading-5 text-ink-muted">{activeFinding.why_changed}</p><p className="leading-5 text-ink-muted">{activeFinding.migration_advice}</p></div></div>;
}

function AiExplanationPanel({ activeFinding, explanation }: { activeFinding: Finding | null; explanation: Explanation | null }) {
  return <div className="rounded-xl border border-brand-orange/20 bg-brand-orange/[0.035] p-4" id="explanation-panel"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg border border-brand-orange/30 bg-brand-orange/10 text-brand-orange"><Sparkles size={14} /></span><div><p className="text-xs font-extrabold text-ink-primary">AI explanation</p><p className="text-[0.62rem] text-ink-muted">Context for your selected migration finding</p></div></div><span className="rounded-md border border-line px-2 py-1 font-mono text-[0.56rem] uppercase text-ink-subtle">Optional</span></div>{activeFinding && explanation ? <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.8fr]"><div><p className="text-xs font-bold text-ink-primary">{explanation.summary}</p><p className="mt-2 text-xs leading-5 text-ink-muted">{explanation.rationale}</p></div><div className="rounded-lg border border-line bg-surface-base/45 p-3"><p className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-ink-subtle">Migration steps</p><ul className="mt-2 space-y-1.5 text-xs text-ink-muted">{explanation.migration_steps.map((step) => <li className="flex gap-2" key={step}><Check className="mt-0.5 shrink-0 text-status" size={13} />{step}</li>)}</ul></div></div> : <p className="mt-4 text-xs leading-5 text-ink-muted">{activeFinding ? 'Generating an explanation for this finding...' : 'Select a finding to generate a plain-language explanation and recommended next steps.'}</p>}</div>;
}

function MigrationPreview({ currentFile, copyCode, copied, result, setActiveFile }: { currentFile?: ScannedFile; copyCode: () => void; copied: boolean; result: MigrationResponse; setActiveFile: (index: number) => void }) {
  const originalLines = currentFile?.original_code.split(/\r?\n/) ?? [];
  const transformedLines = currentFile?.transformed_code.split(/\r?\n/) ?? [];
  return <div className="space-y-3 pt-4"><FilePicker result={result} setActiveFile={setActiveFile} /><div className="flex items-center justify-between"><div className="flex items-center gap-4 font-mono text-[0.58rem] uppercase tracking-[0.12em]"><span className="text-brand-orange">Legacy source</span><span className="text-status">Migrated output</span></div><button className="flex items-center gap-1.5 text-xs font-bold text-ink-muted hover:text-brand-orange" onClick={copyCode} type="button">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy output'}</button></div><div className="grid min-h-56 gap-px overflow-auto rounded-xl border border-line bg-line md:grid-cols-2"><CodePaneLines lines={originalLines} counterpart={transformedLines} tone="legacy" /><CodePaneLines lines={transformedLines} counterpart={originalLines} tone="modern" /></div><details className="rounded-xl border border-line bg-surface-base/40 p-3"><summary className="flex cursor-pointer items-center gap-2 text-xs font-extrabold text-ink-primary"><ChevronDown size={14} />Unified diff</summary><pre className="mt-3 max-h-48 overflow-auto font-mono text-[0.63rem] leading-5 text-ink-muted">{currentFile?.diff_text || 'No changes generated.'}</pre></details></div>;
}

function FilePicker({ result, setActiveFile }: { result: MigrationResponse; setActiveFile: (index: number) => void }) {
  return <select aria-label="Select scanned file" className="max-w-[15rem] rounded-lg border border-line bg-surface-base px-2.5 py-1.5 text-[0.62rem] font-semibold text-ink-muted outline-none focus:border-brand-orange/70" onChange={(event) => setActiveFile(Number(event.target.value))}>{result.files.map((file, index) => <option key={file.file_path} value={index}>{file.file_path}</option>)}</select>;
}

function CodePaneLines({ lines, counterpart, tone }: { lines: string[]; counterpart: string[]; tone: 'legacy' | 'modern' }) {
  return <div className="overflow-auto bg-[#05060a] p-3 font-mono text-[0.61rem] leading-5"><div className="mb-2 flex items-center justify-between border-b border-line pb-2 text-[0.55rem] uppercase tracking-[0.12em] text-ink-subtle"><span>{tone === 'legacy' ? 'Legacy source' : 'Migrated source'}</span><span>{tone === 'legacy' ? 'before' : 'after'}</span></div>{lines.length ? lines.map((line, index) => { const changed = !counterpart.includes(line); return <div className={`flex min-w-max gap-3 px-1.5 ${changed ? tone === 'legacy' ? 'bg-brand-red/10 text-brand-orange' : 'bg-status/10 text-status' : 'text-ink-muted'}`} key={`${line}-${index}`}><span className="w-5 select-none text-right text-ink-subtle/50">{index + 1}</span><code>{highlightCode(line)}</code></div>; }) : <div className="p-3 text-ink-subtle">No file selected.</div>}</div>;
}

function VerificationView({ result }: { result: MigrationResponse }) {
  const { verification } = result;
  return <div className="space-y-3 pt-4"><div className={`rounded-xl border p-4 ${verification.all_valid ? 'border-status/30 bg-status/5' : 'border-brand-orange/30 bg-brand-orange/5'}`}><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-extrabold text-ink-primary"><ShieldCheck className={verification.all_valid ? 'text-status' : 'text-brand-orange'} size={18} />{verification.all_valid ? 'Syntax verification passed' : 'Syntax verification needs review'}</div><span className="font-mono text-[0.65rem] text-ink-muted">{verification.verified_files} verified / {verification.failed_files} failed</span></div><p className="mt-2 text-xs leading-5 text-ink-muted">Verification is syntax-only. LUME does not import or execute user code, so semantic correctness is not assessed.</p></div>{result.files.map((file) => <div className="flex items-start justify-between gap-4 border-b border-line py-3 text-xs" key={file.file_path}><span className="font-mono text-ink-muted">{file.file_path}</span><span className={file.verification.valid ? 'flex items-center gap-1.5 text-status' : 'text-brand-orange'}>{file.verification.valid ? <><Check size={13} />Syntax valid</> : file.verification.error_message || 'Syntax invalid'}</span></div>)}</div>;
}

function ExportView({ exportMarkdown, exportJson, exportDiff, exportPatch, currentFile, copyCode, copied }: { exportMarkdown: () => void; exportJson: () => void; exportDiff: () => void; exportPatch: () => void; currentFile?: ScannedFile; copyCode: () => void; copied: boolean }) {
  const actions = [{ label: 'Download Markdown report', icon: FileText, action: exportMarkdown }, { label: 'Download JSON report', icon: FileCode2, action: exportJson }, { label: 'Download unified diff', icon: GitCompare, action: exportDiff }, { label: 'Download patch file', icon: Download, action: exportPatch }, { label: copied ? 'Copied updated code' : 'Copy updated code', icon: copied ? Check : Clipboard, action: copyCode }];
  return <div className="grid gap-2 pt-4 sm:grid-cols-2">{actions.map((item) => { const Icon = item.icon; return <button className="flex items-center justify-between rounded-xl border border-line bg-surface-base/50 p-3.5 text-left text-xs font-extrabold text-ink-primary transition-colors hover:border-brand-orange/50 hover:bg-brand-orange/5" key={item.label} onClick={item.action} type="button"><span className="flex items-center gap-2.5"><Icon className="text-brand-orange" size={16} />{item.label}</span><ArrowRight className="text-ink-subtle" size={14} /></button>; })}<div className="sm:col-span-2"><p className="mt-2 flex items-center gap-2 text-xs text-status"><CheckCircle2 size={14} />Report ready for handoff</p><p className="mt-1 text-xs text-ink-muted">{currentFile ? 'Exports contain transformed source and deterministic scan results.' : 'Run a migration to generate exports.'}</p></div></div>;
}

function QuickActionsPanel({ className = '', exportMarkdown, hasResult, loadSampleRepository, onNewMigration, onUpload }: { className?: string; exportMarkdown: () => void; hasResult: boolean; loadSampleRepository: () => void; onNewMigration: () => void; onUpload: () => void }) {
  const actions = [{ label: 'Upload repository', description: 'Analyze a new ZIP archive', icon: Upload, onClick: onUpload }, { label: 'Load sample project', description: 'Explore a ready-made example', icon: FolderOpen, onClick: loadSampleRepository }, { label: 'Export latest report', description: hasResult ? 'Download the migration summary' : 'Available after a scan', icon: Download, onClick: exportMarkdown, disabled: !hasResult }, { label: 'Start fresh', description: 'Clear the current workspace', icon: Plus, onClick: onNewMigration }];
  return <PanelCard className={className} eyebrow="Shortcuts" id="quick-actions" title="Quick actions" description="Keep your next migration moving."><div className="space-y-2">{actions.map((action) => { const Icon = action.icon; return <button className="group flex w-full items-center gap-3 rounded-xl border border-line bg-surface-base/45 p-3 text-left transition-colors hover:border-brand-orange/45 hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-45" disabled={action.disabled} key={action.label} onClick={action.onClick} type="button"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-elevated text-brand-orange"><Icon size={15} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-extrabold text-ink-primary">{action.label}</span><span className="mt-0.5 block truncate text-[0.65rem] text-ink-muted">{action.description}</span></span><ArrowRight className="text-ink-subtle transition-transform group-hover:translate-x-0.5" size={14} /></button>; })}</div><div className="mt-5 border-t border-line pt-4"><div className="flex items-center justify-between"><span className="text-xs font-extrabold text-ink-primary">Migration checklist</span><MoreHorizontal className="text-ink-subtle" size={16} /></div><div className="mt-3 space-y-2.5"><ChecklistItem complete={Boolean(hasResult)} label="Source connected" /><ChecklistItem complete={Boolean(hasResult)} label="Rules evaluated" /><ChecklistItem complete={false} label="Review findings" /><ChecklistItem complete={false} label="Export handoff" /></div></div></PanelCard>;
}

function ChecklistItem({ complete, label }: { complete: boolean; label: string }) {
  return <div className="flex items-center gap-2 text-xs"><span className={`grid h-4 w-4 place-items-center rounded-full border ${complete ? 'border-status bg-status/15 text-status' : 'border-line text-transparent'}`}><Check size={10} /></span><span className={complete ? 'text-ink-muted' : 'text-ink-subtle'}>{label}</span></div>;
}

function PanelCard({ action, children, className = '', description, eyebrow, id, title }: { action?: ReactNode; children: ReactNode; className?: string; description: string; eyebrow: string; id?: string; title: string }) {
  return <section className={`rounded-2xl border border-line bg-surface-panel p-4 shadow-panel sm:p-5 ${className}`} id={id}><div className="mb-4 flex items-start justify-between gap-4"><div className="min-w-0"><p className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.16em] text-brand-orange">{eyebrow}</p><h2 className="mt-1 text-sm font-extrabold text-ink-primary">{title}</h2><p className="mt-1 text-xs leading-5 text-ink-muted">{description}</p></div>{action}</div>{children}</section>;
}

function ProgressPanel({ progressIndex }: { progressIndex: number }) {
  return <div className="flex min-h-[22rem] flex-col justify-center px-6 py-6"><div className="flex items-center justify-between"><div><p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-brand-orange">Live migration run</p><h3 className="mt-1 text-base font-extrabold text-ink-primary">{progressStages[progressIndex]}</h3></div><Loader2 className="animate-spin text-brand-orange" size={19} /></div><div className="mt-7 grid gap-2.5">{progressStages.map((stage, index) => <div className="flex items-center gap-3" key={stage}><span className={`grid h-6 w-6 place-items-center rounded-full border ${index < progressIndex ? 'border-status bg-status/10 text-status' : index === progressIndex ? 'border-brand-orange bg-brand-orange/10 text-brand-orange' : 'border-line text-ink-subtle'}`}>{index < progressIndex ? <Check size={13} /> : index === progressIndex ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-orange" /> : <span className="text-[0.58rem]">{index + 1}</span>}</span><span className={`text-xs ${index <= progressIndex ? 'text-ink-primary' : 'text-ink-subtle'}`}>{stage}</span></div>)}</div><p className="mt-7 text-[0.68rem] leading-5 text-ink-muted">LUME performs static analysis and syntax verification only. Your code is never executed.</p></div>;
}

function highlightCode(line: string) {
  const tokens = line.split(/(\b(?:import|from|as|def|class|return|try|except|with|for|in|if|else)\b|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|#.*$)/g);
  return tokens.map((token, index) => {
    const isKeyword = /^(import|from|as|def|class|return|try|except|with|for|in|if|else)$/.test(token);
    const isString = /^("|').*\1$/.test(token);
    const isComment = token.startsWith('#');
    return <span className={isKeyword ? 'text-brand-orange' : isString ? 'text-[#ffbf69]' : isComment ? 'text-ink-subtle' : undefined} key={`${token}-${index}`}>{token}</span>;
  });
}
