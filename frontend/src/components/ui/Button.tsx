import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '../../lib/utils';

type ButtonVariant = 'primaryGlow' | 'outline' | 'quiet';
type ButtonSize = 'default' | 'compact';

interface ButtonBaseProps {
  children: ReactNode;
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>, ButtonBaseProps {
  href?: string;
  target?: AnchorHTMLAttributes<HTMLAnchorElement>['target'];
  rel?: AnchorHTMLAttributes<HTMLAnchorElement>['rel'];
}

const variantClasses: Record<ButtonVariant, string> = {
  primaryGlow:
    'border border-brand-orange/70 bg-brand-gradient bg-[length:200%_100%] text-ink-primary shadow-glow-primary transition-[transform,box-shadow,background-position] hover:bg-right hover:shadow-glow-strong',
  outline:
    'border border-line bg-surface-base/50 text-ink-primary shadow-panel transition-[transform,border-color,background-color] hover:border-brand-red/50 hover:bg-surface-elevated/70',
  quiet: 'text-ink-muted transition-colors hover:text-ink-primary',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-12 px-5 text-sm',
  compact: 'h-10 px-3.5 text-[0.8125rem]',
};

export function Button({
  children,
  className,
  href,
  size = 'default',
  variant = 'primaryGlow',
  ...props
}: ButtonProps) {
  const classes = cn(
    'group inline-flex items-center justify-center gap-2 rounded-xl font-display font-bold tracking-[-0.01em] transition-[transform,box-shadow,border-color,background-position] duration-300 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base disabled:pointer-events-none disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    className,
  );

  if (href) {
    const anchorProps = { ...props };
    delete anchorProps.disabled;
    delete anchorProps.type;

    if (href.startsWith('/')) {
      return (
        <Link className={classes} to={href} {...(anchorProps as Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>)}>
          {children}
        </Link>
      );
    }

    return (
      <a className={classes} href={href} {...(anchorProps as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} type="button" {...props}>
      {children}
    </button>
  );
}
