import { ArrowRight, GitFork, Menu } from 'lucide-react';

import { navigationItems } from '../../data/landing';
import { Button } from '../ui/Button';
import { BrandMark } from '../ui/BrandMark';

export function Header() {
  return (
    <header className="relative z-30 px-4 pt-4 sm:px-6 lg:px-9">
      <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between rounded-2xl border border-line bg-surface-base/70 px-4 shadow-panel backdrop-blur-xl sm:px-5">
        <a
          aria-label="LUME home"
          className="group inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
          href="#top"
        >
          <BrandMark className="transition-transform duration-300 group-hover:rotate-45" />
          <span className="font-display text-xl font-bold tracking-[0.12em] text-ink-primary">LUME</span>
        </a>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {navigationItems.map((item) => (
            <a
              className="rounded-lg px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
              href={item.href}
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
            <span>Star on GitHub</span>
          </Button>
          <Button href="#workflow" size="compact">
            <span className="hidden sm:inline">Try LUME</span>
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
