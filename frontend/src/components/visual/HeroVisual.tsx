import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';

import { processNodes, type ProcessNode } from '../../data/landing';
import { MigrationCoreCanvas } from './MigrationCoreCanvas';
import type { MigrationCoreCanvasHandle } from './MigrationCoreCanvas';

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

const engineParticles = [
  { angle: '-18deg', delay: '-1.2s', duration: '12.5s', radius: '13.5rem', size: '0.22rem', tone: 'ember' },
  { angle: '24deg', delay: '-5.4s', duration: '14s', radius: '15.5rem', size: '0.16rem', tone: 'blue' },
  { angle: '68deg', delay: '-7.1s', duration: '11.5s', radius: '12.25rem', size: '0.2rem', tone: 'ember' },
  { angle: '112deg', delay: '-3.8s', duration: '15.5s', radius: '16.75rem', size: '0.14rem', tone: 'ember' },
  { angle: '158deg', delay: '-9.6s', duration: '13s', radius: '14.5rem', size: '0.18rem', tone: 'blue' },
  { angle: '206deg', delay: '-6.2s', duration: '16.5s', radius: '17.5rem', size: '0.15rem', tone: 'ember' },
  { angle: '244deg', delay: '-2.4s', duration: '10.8s', radius: '11.8rem', size: '0.24rem', tone: 'ember' },
  { angle: '286deg', delay: '-8.5s', duration: '14.8s', radius: '15rem', size: '0.14rem', tone: 'blue' },
  { angle: '328deg', delay: '-4.3s', duration: '12.2s', radius: '13.3rem', size: '0.19rem', tone: 'ember' },
] as const;

export function HeroVisual({ reduceMotion }: HeroVisualProps) {
  const visualRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<MigrationCoreCanvasHandle>(null);
  const [webglReady, setWebglReady] = useState(false);

  const setEnginePosition = (event: PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || !visualRef.current) return;

    const bounds = visualRef.current.getBoundingClientRect();
    const offsetX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const offsetY = (event.clientY - bounds.top) / bounds.height - 0.5;

    visualRef.current.style.setProperty('--engine-pull-x', `${offsetX * 8}px`);
    visualRef.current.style.setProperty('--engine-pull-y', `${offsetY * 8}px`);
    visualRef.current.style.setProperty('--engine-brightness', `${1 + Math.min(Math.hypot(offsetX, offsetY) * 0.16, 0.11)}`);
    coreRef.current?.setPointer(offsetX, offsetY);
  };

  const resetEnginePosition = () => {
    if (!visualRef.current) return;
    visualRef.current.style.setProperty('--engine-pull-x', '0px');
    visualRef.current.style.setProperty('--engine-pull-y', '0px');
    visualRef.current.style.setProperty('--engine-brightness', '1');
    coreRef.current?.setPointer(0, 0);
  };

  const pulseEngine = () => {
    if (!visualRef.current || reduceMotion) return;
    visualRef.current.dataset.pulsing = 'true';
    coreRef.current?.pulse();
    window.setTimeout(() => {
      if (visualRef.current) delete visualRef.current.dataset.pulsing;
    }, 700);
  };

  return (
    <motion.div
      animate="visible"
      aria-label="LUME migration process: detect, analyze, transform, and verify"
      className={`hero-visual${webglReady ? ' hero-visual--webgl' : ''}`}
      initial="hidden"
      onClick={pulseEngine}
      onPointerLeave={resetEnginePosition}
      onPointerMove={setEnginePosition}
      ref={visualRef}
      role="img"
      variants={visualVariants}
    >
      <div aria-hidden="true" className="orbital-trace orbital-trace--outer" />
      <div aria-hidden="true" className="orbital-trace orbital-trace--inner" />

      <MigrationCoreCanvas onReady={setWebglReady} reduceMotion={reduceMotion} ref={coreRef} />

      {!webglReady && (
        <>
          <div aria-hidden="true" className="engine-field">
            <div className="engine-lensing engine-lensing--outer" />
            <div className="engine-lensing engine-lensing--inner" />
            <div className="engine-accretion">
              <div className="engine-accretion__stream engine-accretion__stream--one" />
              <div className="engine-accretion__stream engine-accretion__stream--two" />
            </div>
            <div className="engine-event-horizon" />
            <div className="engine-escape-particle" />
          </div>

          <div aria-hidden="true" className="engine-particles">
            {engineParticles.map((particle, index) => (
              <span
                className={`engine-particle engine-particle--${particle.tone}`}
                key={`${particle.angle}-${index}`}
                style={
                  {
                    '--particle-angle': particle.angle,
                    '--particle-delay': particle.delay,
                    '--particle-duration': particle.duration,
                    '--particle-radius': particle.radius,
                    '--particle-size': particle.size,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        </>
      )}

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
