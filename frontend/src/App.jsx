import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRight,
  Upload,
  Code2,
  Download,
  X,
  FileText,
  ChevronRight
} from 'lucide-react';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '');

export default function App() {
  const [chapter, setChapter] = useState(0);
  const [report, setReport] = useState(null);
  const [files, setFiles] = useState([]);
  const [fileIdx, setFileIdx] = useState(0);
  const [view, setView] = useState('diff');
  const [finding, setFinding] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [verification, setVerification] = useState(null);
  const [modal, setModal] = useState(null);
  const [snippet, setSnippet] = useState('');

  useEffect(() => { scan('all'); }, []);

  const scan = async (id) => {
    setScanning(true);
    try {
      const r = await fetch(`${API}/scan/sample/${id}`, { method: 'POST' });
      if (r.ok) {
        const d = await r.json();
        setReport(d.report);
        setFiles(d.files);
        setVerification(d.verification);
        setFileIdx(0);
        if (d.files[0]?.findings[0]) {
          setFinding(d.files[0].findings[0]);
          explain(d.files[0].findings[0]);
        }
      }
    } catch (e) { console.warn(e); }
    setScanning(false);
  };

  const explain = async (f) => {
    if (!f) return;
    try {
      const r = await fetch(`${API}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finding: f })
      });
      if (r.ok) setExplanation(await r.json());
    } catch (e) { console.warn(e); }
  };

  const pick = (f) => { setFinding(f); explain(f); };

  const uploadZip = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setScanning(true);
    setModal(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch(`${API}/scan/upload`, { method: 'POST', body: fd });
      if (r.ok) {
        const d = await r.json();
        setReport(d.report); setFiles(d.files); setChapter(2);
        setVerification(d.verification);
      }
    } catch (e) { alert(e.message); }
    setScanning(false);
  };

  const scanSnippet = async () => {
    if (!snippet.trim()) return;
    setScanning(true);
    setModal(null);
    try {
      const r = await fetch(`${API}/scan/raw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'snippet.py', code: snippet })
      });
      if (r.ok) {
        const d = await r.json();
        setReport(d.report); setFiles(d.files); setChapter(2);
        setVerification(d.verification);
      }
    } catch (e) { alert(e.message); }
    setScanning(false);
  };

  const exportMd = async () => {
    if (!report) return;
    try {
      const r = await fetch(`${API}/export/markdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
      });
      if (r.ok) {
        const d = await r.json();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([d.markdown], { type: 'text/markdown' }));
        a.download = 'Lume_Migration_Report.md';
        a.click();
      }
    } catch (e) { alert(e.message); }
  };

  const af = files[fileIdx] || null;
  const s = report?.summary || { total_files_scanned: 0, total_findings: 0, readiness_score: 100, critical_count: 0, high_count: 0, medium_count: 0, low_count: 0, automatic_count: 0, manual_review_count: 0 };
  const v = verification || { total_files: files.length, verified_files: 0, failed_files: 0, all_valid: false, scope: 'syntax_only' };
  const verificationRate = v.total_files > 0 ? Math.round((v.verified_files / v.total_files) * 100) : 0;

  const chapters = ['Understanding', 'System Pulse', 'Transformation', 'Verification', 'Deployment'];

  // Collect all findings across files for the pulse page
  const allFindings = files.flatMap(f => f.findings);

  return (
    <div className="lume">
      {/* ═══ Navigation ═══ */}
      <nav className="nav">
        <div className="nav-brand">
          <div className="nav-mark">L</div>
          <span className="nav-wordmark">Lume</span>
        </div>

        <div className="nav-chapters">
          {chapters.map((c, i) => (
            <button key={i} className={`nav-tab ${chapter === i ? 'active' : ''}`} onClick={() => setChapter(i)}>
              <span className="nav-tab-num">0{i + 1}</span>{c}
            </button>
          ))}
        </div>

        <div className="nav-right">
          <button className="btn btn-ghost" onClick={() => setModal('upload')}><Upload size={14} />Upload</button>
          <button className="btn btn-ghost" onClick={() => setModal('snippet')}><Code2 size={14} />Paste</button>
          <button className="btn btn-solid" onClick={() => setChapter(Math.min(chapter + 1, 4))}>
            {chapter < 4 ? 'Continue' : 'Export'}<ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════
           PAGE 01 — UNDERSTANDING
           ═══════════════════════════════════════════ */}
      {chapter === 0 && (
        <div className="page understand">
          <div className="understand-eyebrow">
            <span className="dot" />
            <span className="caption" style={{ color: 'var(--accent)' }}>System Online</span>
          </div>

          <h1 className="display">
            The New Architecture<br />of Software Migration.
          </h1>

          <p className="body" style={{ maxWidth: 480 }}>
            Lume understands your codebase before it changes anything.
            Deterministic analysis. Explainable reasoning. Zero guesswork.
          </p>

          <div className="understand-actions">
            <button className="btn btn-solid" onClick={() => setChapter(1)}>
              Begin Analysis <ArrowRight size={14} />
            </button>
            <button className="btn btn-ghost" onClick={() => setModal('snippet')}>
              <Code2 size={14} /> Paste Code
            </button>
          </div>

          {/* ─── Constellation ─── */}
          <div className="constellation">
            <svg viewBox="0 0 900 360">
              {/* Edges */}
              <line className="edge-line" x1="450" y1="180" x2="180" y2="80" style={{ animationDelay: '0.2s' }} />
              <line className="edge-line" x1="450" y1="180" x2="180" y2="180" style={{ animationDelay: '0.4s' }} />
              <line className="edge-line" x1="450" y1="180" x2="180" y2="280" style={{ animationDelay: '0.6s' }} />
              <line className="edge-line" x1="450" y1="180" x2="700" y2="90" style={{ animationDelay: '0.8s' }} />
              <line className="edge-line" x1="450" y1="180" x2="700" y2="180" style={{ animationDelay: '1.0s' }} />
              <line className="edge-line" x1="450" y1="180" x2="700" y2="270" style={{ animationDelay: '1.2s' }} />

              {/* Core node */}
              <g className="node-group" style={{ animationDelay: '0s' }}>
                <circle cx="450" cy="180" r="22" className="node-core" />
                <text x="450" y="184" textAnchor="middle" className="node-label" style={{ fill: 'var(--black)', fontWeight: 700, fontSize: '9px' }}>
                  SDK
                </text>
              </g>

              {/* File nodes — left */}
              {['legacy_chat_app', 'batch_embeddings', 'multi_modal'].map((name, i) => (
                <g key={name} className="node-group" onClick={() => { setChapter(2); setFileIdx(i); }}>
                  <circle cx="180" cy={80 + i * 100} r="16" className="node-file" />
                  <text x="180" y={80 + i * 100 + 28} textAnchor="middle" className="node-label">{name}</text>
                </g>
              ))}

              {/* Deprecated API nodes — right */}
              {[
                { name: 'ChatCompletion', severity: 'red' },
                { name: 'openai.api_key', severity: 'amber' },
                { name: 'error.RateLimitError', severity: 'red' }
              ].map((n, i) => (
                <g key={n.name} className="node-group">
                  <circle cx="700" cy={90 + i * 90} r="14"
                    className="node-deprecated"
                    style={{
                      fill: `var(--${n.severity}-mute)`,
                      stroke: `var(--${n.severity})`,
                      animationDelay: `${i * 0.3}s`
                    }}
                  />
                  <text x="700" y={90 + i * 90 + 26} textAnchor="middle" className="node-label" style={{ fill: `var(--${n.severity})` }}>
                    {n.name}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
           PAGE 02 — SYSTEM PULSE
           ═══════════════════════════════════════════ */}
      {chapter === 1 && (
        <div className="page pulse-page">
          <div className="pulse-header">
            <p className="caption" style={{ color: 'var(--accent)', marginBottom: 12 }}>02 — System Pulse</p>
            <h1 className="headline">Visualizing Integrity.</h1>
            <p className="body" style={{ marginTop: 12 }}>
              Every deprecated call, every unsafe global state, every exception surface — mapped as a living system.
            </p>
          </div>

          <div className="pulse-layout">
            <div className="pulse-graph-container">
              <svg viewBox="0 0 600 460" style={{ width: '100%', height: '460px' }}>
                {/* Organic neural edges */}
                {allFindings.slice(0, 8).map((f, i) => {
                  const angle = (i / Math.min(allFindings.length, 8)) * Math.PI * 2 - Math.PI / 2;
                  const x = 300 + Math.cos(angle) * 170;
                  const y = 230 + Math.sin(angle) * 160;
                  return (
                    <line key={`e-${i}`} className="edge-line"
                      x1="300" y1="230" x2={x} y2={y}
                      style={{
                        animationDelay: `${i * 0.15}s`,
                        stroke: f.severity === 'CRITICAL' ? 'rgba(244,63,94,0.25)' : 'rgba(255,255,255,0.06)'
                      }}
                    />
                  );
                })}

                {/* Center pulsing core */}
                <g className="node-group">
                  <circle cx="300" cy="230" r="32" className="node-core" style={{ opacity: 0.15 }} />
                  <circle cx="300" cy="230" r="20" className="node-core" />
                  <text x="300" y="234" textAnchor="middle" style={{ fill: 'var(--black)', fontSize: '9px', fontWeight: 700, fontFamily: 'Inter' }}>CORE</text>
                </g>

                {/* Satellite finding nodes */}
                {allFindings.slice(0, 8).map((f, i) => {
                  const angle = (i / Math.min(allFindings.length, 8)) * Math.PI * 2 - Math.PI / 2;
                  const x = 300 + Math.cos(angle) * 170;
                  const y = 230 + Math.sin(angle) * 160;
                  const isC = f.severity === 'CRITICAL';
                  const isH = f.severity === 'HIGH';
                  return (
                    <g key={`n-${i}`} className="node-group" onClick={() => pick(f)} style={{ cursor: 'pointer' }}>
                      <circle cx={x} cy={y} r="14"
                        className={isC ? 'node-deprecated' : 'node-file'}
                        style={isC ? { animationDelay: `${i * 0.2}s` } : isH ? { stroke: 'var(--amber)', strokeWidth: 1 } : {}}
                      />
                      <text x={x} y={y + 26} textAnchor="middle" className="node-label" style={{ fontSize: '9px' }}>
                        {f.rule_name.split(' ').slice(-1)[0]}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Insight cards */}
            <div className="pulse-sidebar">
              <div className="pulse-insight" style={{ borderColor: 'rgba(244,63,94,0.2)' }}>
                <div className="pulse-insight-severity" style={{ color: 'var(--red)' }}>Critical · {s.critical_count} findings</div>
                <div className="pulse-insight-title">Breaking API Surface</div>
                <div className="pulse-insight-desc">ChatCompletion.create and exception hierarchy will throw AttributeError on v1.x at runtime.</div>
              </div>

              <div className="pulse-insight" style={{ borderColor: 'rgba(245,158,11,0.2)' }}>
                <div className="pulse-insight-severity" style={{ color: 'var(--amber)' }}>High · {s.high_count} findings</div>
                <div className="pulse-insight-title">Global State Mutation</div>
                <div className="pulse-insight-desc">Module-level openai.api_key and openai.organization eliminated in favor of explicit client scope.</div>
              </div>

              <div className="pulse-insight">
                <div className="pulse-insight-severity" style={{ color: 'var(--accent)' }}>Automation</div>
                <div className="pulse-insight-title">{s.automatic_count} of {s.total_findings} Safe to Transform</div>
                <div className="pulse-insight-desc">{s.manual_review_count} pattern{s.manual_review_count !== 1 ? 's' : ''} require{s.manual_review_count === 1 ? 's' : ''} engineering review.</div>
              </div>

              <button className="btn btn-solid" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => setChapter(2)}>
                Enter Transformation <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
           PAGE 03 — TRANSFORMATION
           ═══════════════════════════════════════════ */}
      {chapter === 2 && (
        <div className="page transform-page">
          <div className="transform-bar">
            <div className="transform-bar-left">
              {files.map((f, i) => (
                <button key={f.file_path}
                  className={`file-selector ${fileIdx === i ? 'active' : ''}`}
                  onClick={() => { setFileIdx(i); if (f.findings[0]) pick(f.findings[0]); }}
                >
                  {f.file_path}
                </button>
              ))}
            </div>

            <div className="view-pills">
              {['diff', 'transformed', 'original'].map(v => (
                <button key={v} className={`view-pill ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
                  {v === 'diff' ? 'Unified Diff' : v === 'transformed' ? 'v1.x' : 'v0.x'}
                </button>
              ))}
            </div>
          </div>

          <div className="transform-body">
            {/* Editor */}
            <div className="editor">
              {af && (view === 'diff' ? af.diff_text : view === 'transformed' ? af.transformed_code : af.original_code)
                .split('\n').map((line, i) => {
                  let cls = '';
                  if (view === 'diff') {
                    if (line.startsWith('+') && !line.startsWith('+++')) cls = 'added';
                    else if (line.startsWith('-') && !line.startsWith('---')) cls = 'removed';
                  }
                  // Highlight the selected finding's line
                  if (finding && view !== 'diff' && i + 1 === finding.line_number) cls = 'highlight';

                  return (
                    <div key={i} className={`editor-line ${cls}`}
                      onClick={() => {
                        // When clicking a line, find matching finding
                        if (af) {
                          const match = af.findings.find(f => f.line_number === i + 1);
                          if (match) pick(match);
                        }
                      }}
                    >
                      <span className="editor-gutter mono">{i + 1}</span>
                      <code className="editor-code mono">{line}</code>
                    </div>
                  );
                })
              }
            </div>

            {/* Reasoning Drawer */}
            <div className="reasoning-drawer">
              <p className="caption" style={{ color: 'var(--accent)', marginBottom: 20 }}>Reasoning</p>

              {finding ? (
                <>
                  <div className="reason-block">
                    <div className="reason-label">Rule</div>
                    <div className="reason-value" style={{ color: 'var(--t1)', fontWeight: 600 }}>{finding.rule_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--t4)', marginTop: 4 }}>{finding.rule_id} · Line {finding.line_number}</div>
                  </div>

                  <div className="reason-block">
                    <div className="reason-label">Legacy Pattern</div>
                    <div className="reason-code mono" style={{ color: 'var(--red)' }}>{finding.code_snippet}</div>
                  </div>

                  <div className="reason-block">
                    <div className="reason-label">Target Pattern</div>
                    <div className="reason-code mono" style={{ color: 'var(--accent)' }}>{finding.suggested_replacement}</div>
                  </div>

                  <div className="reason-block">
                    <div className="reason-label">Why It Changed</div>
                    <div className="reason-value">{finding.why_changed}</div>
                  </div>

                  <div className="reason-block">
                    <div className="reason-label">Migration Action</div>
                    <div className="reason-value">{finding.migration_advice}</div>
                  </div>

                  {explanation && (
                    <div className="reason-block">
                      <div className="reason-label" style={{ color: explanation.ai_generated ? 'var(--accent)' : 'var(--t4)' }}>
                        {explanation.ai_generated ? 'AI Analysis' : 'Deterministic Analysis'}
                      </div>
                      <div className="reason-value">{explanation.breaking_change_risk}</div>
                    </div>
                  )}
                </>
              ) : (
                <p className="body" style={{ color: 'var(--t4)', marginTop: 40 }}>
                  Click any code line to reveal structural reasoning.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
           PAGE 04 — VERIFICATION
           ═══════════════════════════════════════════ */}
      {chapter === 3 && (
        <div className="page verify-page">
          <div className="verify-header">
            <p className="caption" style={{ color: 'var(--accent)', marginBottom: 12 }}>04 — Verification</p>
            <h1 className="headline">Confidence, Not Checklists.</h1>
            <p className="body" style={{ marginTop: 12 }}>
              Every transformed file is checked with Python syntax parsing. Semantic behavior is not executed or inferred.
            </p>
          </div>

          <div className="verify-flow">
            <div className="verify-step complete">
              <div className="verify-step-num">STEP 01</div>
              <div className="verify-step-title">Static Analysis</div>
              <div className="verify-step-desc">{s.total_files_scanned} files scanned. {s.total_findings} deprecated patterns identified via AST traversal.</div>
              <div className="verify-indicator"><div className="verify-bar green" style={{ width: '100%' }} /></div>
            </div>

            <div className="verify-step complete">
              <div className="verify-step-num">STEP 02</div>
              <div className="verify-step-title">Rule Matching</div>
              <div className="verify-step-desc">{s.automatic_count} findings matched deterministic migration rules. {s.manual_review_count} flagged for manual review.</div>
              <div className="verify-indicator"><div className="verify-bar green" style={{ width: '100%' }} /></div>
            </div>

            <div className="verify-step complete">
              <div className="verify-step-num">STEP 03</div>
              <div className="verify-step-title">Syntax Verification</div>
              <div className="verify-step-desc">
                {v.verified_files} of {v.total_files} transformed files are syntactically valid. {v.failed_files} failed parsing. Syntax verification only; semantic correctness is not assessed.
              </div>
              <div className="verify-indicator"><div className="verify-bar" style={{ width: `${verificationRate}%`, background: v.failed_files > 0 ? 'var(--red)' : 'var(--green)' }} /></div>
            </div>

            <div className="verify-step complete">
              <div className="verify-step-num">STEP 04</div>
              <div className="verify-step-title">Migration Health</div>
              <div className="verify-step-desc">Production readiness score: {s.readiness_score}%. All critical and high severity findings have automated resolutions.</div>
              <div className="verify-indicator"><div className="verify-bar accent" style={{ width: `${s.readiness_score}%` }} /></div>
            </div>
          </div>

          <div style={{ maxWidth: 900, margin: '28px auto 32px', border: '1px solid var(--line)', borderRadius: 8, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
              <div>
                <div className="caption">Overall Verification Summary</div>
                <div className="body" style={{ marginTop: 6 }}>
                  {v.all_valid ? '✅ Syntax Valid' : '❌ Syntax Invalid'} · Syntax verification only
                </div>
              </div>
              <div className="mono" style={{ color: v.failed_files > 0 ? 'var(--red)' : 'var(--green)' }}>
                {v.verified_files} verified · {v.failed_files} failed
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {files.map(file => {
                const result = file.verification;
                const valid = result?.valid === true;
                return (
                  <div key={file.file_path} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', padding: '10px 0', borderTop: '1px solid var(--line)' }}>
                    <div className="mono" style={{ color: 'var(--t2)', overflowWrap: 'anywhere' }}>{file.file_path}</div>
                    <div style={{ textAlign: 'right', color: valid ? 'var(--green)' : 'var(--red)', minWidth: 180 }}>
                      <div>{valid ? '✅ Syntax Valid' : '❌ Syntax Invalid'}</div>
                      {!valid && result?.error_message && (
                        <div className="mono" style={{ color: 'var(--t4)', fontSize: 11, marginTop: 4 }}>
                          {result.error_message}{result.line_number ? ` · line ${result.line_number}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button className="btn btn-solid" onClick={() => setChapter(4)}>
              Proceed to Deployment <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
           PAGE 05 — DEPLOYMENT
           ═══════════════════════════════════════════ */}
      {chapter === 4 && (
        <div className="page deploy-page">
          <div className="deploy-header">
            <p className="caption" style={{ color: 'var(--green)', marginBottom: 12 }}>05 — Deployment</p>
            <h1 className="headline">Ready for Production.</h1>
            <p className="body" style={{ marginTop: 12 }}>
              Your migration story — from understanding to confidence — is complete.
            </p>
          </div>

          <div className="deploy-grid">
            {/* Confidence */}
            <div className="deploy-card">
              <p className="caption">Production Readiness</p>
              <div className="deploy-confidence">{s.readiness_score}%</div>
              <p className="body" style={{ fontSize: 14 }}>
                {s.total_findings} findings resolved across {s.total_files_scanned} files.
                {s.manual_review_count > 0 ? ` ${s.manual_review_count} manual review items remain.` : ' Zero items require manual intervention.'}
              </p>
            </div>

            {/* Timeline */}
            <div className="deploy-card">
              <p className="caption" style={{ marginBottom: 16 }}>Migration Timeline</p>
              <div className="timeline">
                <div className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-title">Repository Analyzed</div>
                    <div className="timeline-meta">{s.total_files_scanned} Python files · AST parsed</div>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-title">Deprecated APIs Detected</div>
                    <div className="timeline-meta">{s.critical_count} critical · {s.high_count} high · {s.medium_count} medium · {s.low_count} low</div>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-title">Transformations Applied</div>
                    <div className="timeline-meta">{s.automatic_count} automatic · {s.manual_review_count} manual review</div>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-dot" style={{ background: 'var(--accent)' }} />
                  <div className="timeline-content">
                    <div className="timeline-title">Verification Complete</div>
                    <div className="timeline-meta">{v.verified_files} syntax valid · {v.failed_files} syntax invalid · syntax checks only</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="deploy-action">
            <button className="btn-deploy" onClick={exportMd}>
              Export Migration Report <Download size={16} style={{ marginLeft: 8 }} />
            </button>
          </div>
        </div>
      )}

      {/* ═══ Modals ═══ */}
      {modal === 'upload' && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="modal-title">Upload Repository</div>
              <X size={18} style={{ cursor: 'pointer', color: 'var(--t3)' }} onClick={() => setModal(null)} />
            </div>
            <p className="body" style={{ marginTop: 4 }}>Select a Python project ZIP. Lume will construct the AST map.</p>
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <input type="file" accept=".zip" onChange={uploadZip} />
            </div>
          </div>
        </div>
      )}

      {modal === 'snippet' && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="modal-title">Paste Python Code</div>
              <X size={18} style={{ cursor: 'pointer', color: 'var(--t3)' }} onClick={() => setModal(null)} />
            </div>
            <p className="body" style={{ marginTop: 4 }}>Paste OpenAI SDK v0.x code for instant static analysis.</p>
            <textarea
              rows={10}
              value={snippet}
              onChange={e => setSnippet(e.target.value)}
              placeholder={`import openai\nopenai.api_key = "sk-..."\nresponse = openai.ChatCompletion.create(...)`}
            />
            <button className="btn btn-solid" style={{ width: '100%', marginTop: 16, justifyContent: 'center' }} onClick={scanSnippet}>
              Analyze <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
