import { ArrowRight, BookOpenCheck, Cpu } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

import { trustFeatures } from '../../data/landing';
import { Button } from '../ui/Button';
import { HeroVisual } from '../visual/HeroVisual';

const copyTransition = { duration: 0.65, ease: [0.16, 1, 0.3, 1] as const };

export function HeroSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative" id="product">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-hero-radial" />
      <div aria-hidden="true" className="hero-grid-mask pointer-events-none absolute inset-x-0 top-0 -z-10 h-full bg-hero-grid bg-[length:4.5rem_4.5rem]" />

      <div className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-[90rem] grid-cols-1 items-center gap-8 px-6 pb-10 pt-14 sm:px-9 md:pb-14 lg:grid-cols-2 lg:gap-4 lg:px-12 lg:pt-16 xl:px-16">
        <div className="relative z-10 max-w-2xl lg:pb-12">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-brand-red/35 bg-surface-base/75 px-3 py-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-brand-orange shadow-glow-primary"
            initial={{ opacity: 0, y: 12 }}
            transition={copyTransition}
          >
            <Cpu aria-hidden="true" size={14} />
            AI-powered migration engine
          </motion.div>

          <motion.h1
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[13ch] font-display text-[clamp(3rem,5.6vw,5.85rem)] font-extrabold leading-[0.99] tracking-[-0.065em] text-ink-primary"
            initial={{ opacity: 0, y: 20 }}
            transition={{ ...copyTransition, delay: 0.08 }}
          >
            Migrate OpenAI SDKs. <span className="text-brand-gradient bg-clip-text text-transparent">Automatically.</span>{' '}
            Accurately.
          </motion.h1>

          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="mt-7 max-w-xl text-base leading-8 text-ink-muted sm:text-lg"
            initial={{ opacity: 0, y: 18 }}
            transition={{ ...copyTransition, delay: 0.16 }}
          >
            LUME analyzes your codebase, applies deterministic transforms, and delivers production-ready OpenAI SDK migrations with confidence.
          </motion.p>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mt-9 flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 16 }}
            transition={{ ...copyTransition, delay: 0.24 }}
          >
            <Button href="#workflow">
              Start Migration
              <ArrowRight aria-hidden="true" size={18} />
            </Button>
            <Button href="#features" variant="outline">
              <BookOpenCheck aria-hidden="true" size={18} />
              View Documentation
            </Button>
          </motion.div>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mt-12"
            initial={{ opacity: 0, y: 14 }}
            transition={{ ...copyTransition, delay: 0.32 }}
          >
            <p className="mb-5 flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ink-subtle">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-red shadow-glow-primary" />
              Trusted by developers
            </p>
            <ul className="flex flex-wrap gap-x-6 gap-y-3" id="features">
              {trustFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li className="inline-flex items-center gap-2 text-sm text-ink-muted" key={feature.label}>
                    <Icon aria-hidden="true" className="text-brand-orange" size={19} strokeWidth={1.7} />
                    {feature.label}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </div>

        <HeroVisual reduceMotion={reduceMotion} />
      </div>
    </section>
  );
}
