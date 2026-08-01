import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';

import { processNodes, type ProcessNode } from '../../data/landing';

export interface HeroVisualProps {
  reduceMotion: boolean | null;
}

const nodeClassNames: Record<ProcessNode['id'], string> = {
  detect: 'process-node--detect',
  analyze: 'process-node--analyze',
  transform: 'process-node--transform',
  verify: 'process-node--verify',
};

const visualVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 18 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { delay: 0.18, duration: 0.75, ease: [0.16, 1, 0.3, 1] },
  },
};

export function HeroVisual({ reduceMotion }: HeroVisualProps) {
  return (
    <motion.div
      animate="visible"
      aria-label="LUME migration process: detect, analyze, transform, and verify"
      className="hero-visual"
      initial="hidden"
      role="img"
      variants={visualVariants}
    >
      <svg aria-hidden="true" className="hero-connections" fill="none" viewBox="0 0 720 610">
        <defs>
          <filter id="connectionGlow" height="160%" width="160%" x="-30%" y="-30%">
            <feGaussianBlur result="blur" stdDeviation="3" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {['M552 90C508 110 492 150 465 182', 'M250 251C315 266 342 285 383 301', 'M544 405C505 384 485 365 453 342', 'M392 480C402 432 410 400 414 355'].map((path) => (
          <motion.path
            animate={reduceMotion ? undefined : { strokeDashoffset: [0, -56] }}
            d={path}
            filter="url(#connectionGlow)"
            key={path}
            stroke="var(--brand-red)"
            strokeDasharray="4 12"
            strokeLinecap="round"
            strokeWidth="1.5"
            transition={{ duration: 2.2, ease: 'linear', repeat: Infinity }}
          />
        ))}
        <path d="M492 168C606 148 642 241 579 282S487 391 595 448" opacity="0.34" stroke="var(--brand-orange)" strokeDasharray="2 14" strokeWidth="1" />
        <path d="M347 183C302 211 281 298 327 365S411 473 362 524" opacity="0.24" stroke="var(--hero-blue-strong)" strokeDasharray="2 15" strokeWidth="1" />
      </svg>

      <div aria-hidden="true" className="orbital-trace orbital-trace--outer" />
      <div aria-hidden="true" className="orbital-trace orbital-trace--inner" />

      <div aria-hidden="true" className="lume-orb animate-orb-breathe">
        <div className="lume-orb__core" />
        <div className="lume-orb__mark">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      {processNodes.map((node, index) => {
        const Icon = node.icon;
        return (
          <motion.div
            animate={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
            className={`process-node ${nodeClassNames[node.id]}`}
            initial={{ opacity: 0, y: 12 }}
            key={node.id}
            transition={{ delay: 0.38 + index * 0.12, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="process-node__icon">
              <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
            </div>
            <div>
              <p className="process-node__title">{node.title}</p>
              <p className="process-node__description">{node.description}</p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
