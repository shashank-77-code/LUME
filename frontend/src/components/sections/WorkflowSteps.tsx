import { motion, useReducedMotion } from 'framer-motion';

import { workflowSteps } from '../../data/landing';

export function WorkflowSteps() {
  const reduceMotion = useReducedMotion();

  return (
    <section aria-labelledby="workflow-title" className="relative px-6 pb-16 pt-4 sm:px-9 sm:pb-20 lg:px-12 xl:px-16" id="workflow">
      <div className="mx-auto max-w-[90rem]">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-brand-orange">The LUME workflow</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.045em] text-ink-primary sm:text-3xl" id="workflow-title">
              Every stage, made visible.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-ink-muted">A deterministic path from repository input to a syntax-verified migration report.</p>
        </div>

        <ol className="workflow-list relative isolate flex snap-x snap-mandatory gap-4 overflow-x-auto rounded-panel border border-line bg-surface-panel/75 px-5 py-7 shadow-panel sm:px-7 lg:justify-between lg:overflow-visible">
          {workflowSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.li
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 min-w-[10.5rem] snap-center text-center lg:min-w-0 lg:flex-1"
                initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }}
                key={step.title}
                transition={{ delay: index * 0.07, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-red/30 bg-surface-elevated text-brand-orange shadow-glow-primary sm:h-[4.5rem] sm:w-[4.5rem]">
                  <Icon aria-hidden="true" size={29} strokeWidth={1.55} />
                </div>
                <p className="mt-4 font-display text-sm font-bold tracking-[-0.02em] text-ink-primary">
                  {index + 1}. {step.title}
                </p>
                <p className="mt-1 text-xs text-ink-muted">{step.description}</p>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
