import { useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Braces,
  FileCode2,
  FileSearch2,
  FolderOpen,
  GitCompare,
  GitBranch,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '../ui/Button';

interface PipelineStep {
  title: string;
  description: string;
  icon: typeof FolderOpen;
}

const pipeline: readonly PipelineStep[] = [
  { title: 'Repository', description: 'Bring a ZIP, snippet, or sample source.', icon: FolderOpen },
  { title: 'AST Analysis', description: 'Map Python structure without execution.', icon: GitBranch },
  { title: 'Migration Rules', description: 'Match known OpenAI SDK changes.', icon: FileSearch2 },
  { title: 'Codemod Engine', description: 'Apply deterministic source transforms.', icon: Braces },
  { title: 'Syntax Verification', description: 'Parse every transformed file safely.', icon: ShieldCheck },
  { title: 'Migration Report', description: 'Review findings, diffs, and exports.', icon: FileCode2 },
];

const engineFeatures: readonly PipelineStep[] = [
  { title: 'AST Analysis', description: 'Understand code structure before changing it.', icon: GitBranch },
  { title: 'Rules Engine', description: 'Use explicit, inspectable migration rules.', icon: FileSearch2 },
  { title: 'Codemod', description: 'Transform supported patterns consistently.', icon: Braces },
  { title: 'Verification', description: 'Confirm generated Python syntax parses.', icon: ShieldCheck },
];

const legacyCode = [
  'import openai',
  '',
  'openai.api_key = os.getenv("OPENAI_API_KEY")',
  'response = openai.ChatCompletion.create(',
  '    model="gpt-4",',
  '    messages=messages,',
  ')',
].join('\n');

const modernCode = [
  'from openai import OpenAI',
  '',
  'client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))',
  'response = client.chat.completions.create(',
  '    model="gpt-4",',
  '    messages=messages,',
  ')',
].join('\n');

export function ProductLanding() {
  const [showModern, setShowModern] = useState(true);

  return (
    <>
      <ArchitectureSection />
      <DemoSection showModern={showModern} setShowModern={setShowModern} />
      <EngineSection />
      <section className="px-6 pb-24 pt-14 sm:px-9 lg:px-12 xl:px-16" id="launch">
        <motion.div
          className="section-ambient mx-auto flex max-w-[90rem] flex-col items-center rounded-panel border border-brand-red/25 bg-surface-panel px-6 py-16 text-center shadow-panel sm:px-12"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
        >
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand-orange">Workspace ready</p>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-extrabold tracking-[-0.06em] text-ink-primary dream-glow sm:text-5xl">Ready to migrate your repository?</h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-ink-muted">Upload your project and review deterministic transformations before deployment.</p>
          <Button className="mt-8" href="/workspace">
            Launch Workspace
            <ArrowRight aria-hidden="true" size={18} />
          </Button>
        </motion.div>
      </section>
    </>
  );
}

function ArchitectureSection() {
  return (
    <section className="section-ambient px-6 py-24 sm:px-9 lg:px-12 xl:px-16" id="architecture">
      <div className="mx-auto max-w-[90rem]">
        <SectionIntro eyebrow="System architecture" title="How LUME Works" description="A visible pipeline from source repository to reviewable migration report." />
        <div className="mt-12 grid gap-3 md:grid-cols-6">
          {pipeline.map((step, index) => {
            const Icon = step.icon;
            return (
              <div className="relative md:col-span-1" key={step.title}>
        <motion.div
          className="group h-full rounded-2xl border border-line bg-surface-panel/80 p-5 shadow-panel transition-[transform,box-shadow,border-color,background-color] duration-300 hover:-translate-y-1 hover:border-brand-orange/60 hover:bg-surface-elevated hover:shadow-glow-primary"
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.55, ease: 'easeOut' }}
                  viewport={{ once: true, amount: 0.45 }}
                >
                  <div className="mb-7 flex items-center justify-between"><span className="font-mono text-[0.625rem] text-ink-subtle">0{index + 1}</span><Icon aria-hidden="true" className="text-brand-orange transition-transform duration-300 group-hover:scale-110" size={19} /></div>
                  <h3 className="font-display text-sm font-extrabold text-ink-primary">{step.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-ink-muted">{step.description}</p>
                </motion.div>
                {index < pipeline.length - 1 && <ArrowRight aria-hidden="true" className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-ink-subtle md:block" size={16} />}
                {index < pipeline.length - 1 && <motion.span aria-hidden="true" className="absolute left-full top-1/2 hidden h-px w-3 origin-left bg-brand-orange/50 md:block" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} transition={{ delay: index * 0.1 + 0.25, duration: 0.35, ease: 'easeOut' }} viewport={{ once: true }} />}
                {index < pipeline.length - 1 && <ArrowDown aria-hidden="true" className="mx-auto my-2 text-ink-subtle md:hidden" size={16} />}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DemoSection({ showModern, setShowModern }: { showModern: boolean; setShowModern: (value: boolean) => void }) {
  return (
    <section className="section-ambient border-y border-line bg-surface-panel/25 px-6 py-24 sm:px-9 lg:px-12 xl:px-16" id="demo">
      <div className="mx-auto max-w-[90rem]">
        <SectionIntro eyebrow="Transformation preview" title="See the change before it ships." description="The migration engine makes every supported transformation visible and reviewable." />
        <div className="mt-12 overflow-hidden rounded-2xl border border-line bg-surface-base shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand-red" /><span className="h-2 w-2 rounded-full bg-brand-orange" /><span className="h-2 w-2 rounded-full bg-status" /><span className="ml-3 font-mono text-[0.625rem] text-ink-subtle">migration_preview.py</span></div>
            <button className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-muted transition-colors hover:border-brand-orange/60 hover:text-ink-primary" onClick={() => setShowModern(!showModern)} type="button"><GitCompare size={14} />{showModern ? 'View legacy' : 'View migrated'}</button>
          </div>
          <div className="grid lg:grid-cols-2">
            <CodePane label="Legacy OpenAI SDK" code={legacyCode} tone="legacy" visible={!showModern} />
            <CodePane label="Modern OpenAI SDK" code={modernCode} tone="modern" visible={showModern} />
          </div>
          <div className="flex items-center justify-center gap-3 border-t border-line px-4 py-4 text-xs text-ink-muted"><span className="h-px flex-1 bg-line" /><span className="inline-flex items-center gap-2 font-mono uppercase tracking-[0.14em] text-brand-orange"><ArrowRight size={14} /> deterministic transform</span><span className="h-px flex-1 bg-line" /></div>
        </div>
      </div>
    </section>
  );
}

function CodePane({ label, code, tone, visible }: { label: string; code: string; tone: 'legacy' | 'modern'; visible: boolean }) {
  return (
    <motion.div animate={{ opacity: visible ? 1 : 0.54 }} className={'min-h-72 border-b border-line p-5 lg:border-b-0 ' + (tone === 'modern' ? 'lg:border-l' : '')} transition={{ duration: 0.3 }}>
      <div className="mb-4 flex items-center justify-between"><span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-ink-subtle">{label}</span><span className={'rounded-full border px-2 py-1 font-mono text-[0.5625rem] ' + (tone === 'modern' ? 'border-status/30 text-status' : 'border-brand-red/30 text-brand-orange')}>{tone === 'modern' ? 'v1.x' : 'v0.x'}</span></div>
      <pre className="overflow-x-auto font-mono text-[0.6875rem] leading-6 text-ink-muted"><code>{code.split('\n').map((line, index) => <span className={'block ' + (index === 2 || index === 3 ? tone === 'modern' ? 'rounded bg-status/10 text-status' : 'rounded bg-brand-red/10 text-brand-orange' : '')} key={line + index}><span className="mr-4 inline-block w-4 select-none text-right text-ink-subtle/60">{index + 1}</span>{line || ' '}</span>)}</code></pre>
    </motion.div>
  );
}

function EngineSection() {
  return (
    <section className="section-ambient px-6 py-24 sm:px-9 lg:px-12 xl:px-16" id="engine">
      <div className="mx-auto max-w-[90rem]">
        <SectionIntro eyebrow="Deterministic migration engine" title="Small primitives. Clear outcomes." description="Four focused systems keep the migration inspectable from input to verification." />
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {engineFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return <motion.div className="group rounded-2xl border border-line bg-surface-panel/70 p-6 shadow-panel transition-[transform,box-shadow,border-color,background-color] duration-300 hover:-translate-y-1 hover:border-brand-orange/60 hover:bg-surface-elevated hover:shadow-glow-primary" initial={{ opacity: 0, y: 40 }} key={feature.title} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1, duration: 0.6, ease: 'easeOut' }} viewport={{ once: true, amount: 0.4 }}><Icon aria-hidden="true" className="text-brand-orange transition-transform duration-300 group-hover:translate-x-0.5" size={21} /><h3 className="mt-8 font-display text-sm font-extrabold text-ink-primary dream-glow">{feature.title}</h3><p className="mt-2 text-xs leading-5 text-ink-muted">{feature.description}</p></motion.div>;
          })}
        </div>
      </div>
    </section>
  );
}

function SectionIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="max-w-2xl"><p className="font-mono text-xs uppercase tracking-[0.2em] text-brand-orange">{eyebrow}</p><h2 className="mt-3 font-display text-3xl font-extrabold tracking-[-0.055em] text-ink-primary dream-glow sm:text-4xl">{title}</h2><p className="mt-4 text-sm leading-7 text-ink-muted">{description}</p></div>;
}
