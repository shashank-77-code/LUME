import { useEffect, useState } from 'react';
import { ArrowRight, GitFork, Menu } from 'lucide-react';

import { navigationItems } from '../../data/landing';
import { Button } from '../ui/Button';
import { BrandMark } from '../ui/BrandMark';

export function Header() {
  const isWorkspace = window.location.pathname.startsWith('/workspace');
  const [activeSection, setActiveSection] = useState(isWorkspace ? 'workspace' : 'architecture');

  useEffect(() => {
    if (isWorkspace) return;

    const sections = navigationItems
      .filter((item) => item.href.startsWith('#'))
      .map((item) => item.href.slice(1));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: [0.1, 0.35, 0.7] },
    );

    sections.forEach((id) => document.getElementById(id) && observer.observe(document.getElementById(id)!));
    return () => observer.disconnect();
  }, [isWorkspace]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 lg:px-9">
      <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between rounded-2xl border border-line bg-surface-base/85 px-4 shadow-[0_1rem_3rem_rgb(0_0_0_/_28%)] backdrop-blur-2xl transition-colors sm:px-5">
        <a
          aria-label="LUME home"
          className="group inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
          href={isWorkspace ? '/' : '#top'}
        >
          <BrandMark className="transition-transform duration-300 group-hover:rotate-45" />
          <span className="font-display text-xl font-bold tracking-[0.12em] text-ink-primary">LUME</span>
        </a>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {navigationItems.map((item) => (
            <a
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange ${activeSection === item.href.slice(1) || (item.label === 'Workspace' && isWorkspace) ? 'bg-surface-elevated text-ink-primary shadow-panel' : 'text-ink-muted hover:text-ink-primary'}`}
              href={item.href.startsWith('#') && isWorkspace ? `/${item.href}` : item.href}
              key={item.label}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            aria-label="View LUME on GitHub"
            className="hidden sm:inline-flex"
            href="https://github.com/shashank-77-code/LUME"
            rel="noreferrer"
            size="compact"
            target="_blank"
            variant="outline"
          >
            <GitFork aria-hidden="true" size={16} />
            <span>GitHub</span>
          </Button>
          <Button href="/workspace" size="compact">
            <span className="hidden sm:inline">Launch Workspace</span>
            <span className="sm:hidden">Start</span>
            <ArrowRight aria-hidden="true" size={16} />
          </Button>
          <button
            aria-label="Open navigation"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange lg:hidden"
            type="button"
          >
            <Menu aria-hidden="true" size={19} />
          </button>
        </div>
      </div>
    </header>
  );
}
