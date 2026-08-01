import { cn } from '../../lib/utils';

export interface BrandMarkProps {
  className?: string;
  title?: string;
}

export function BrandMark({ className, title }: BrandMarkProps) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={cn('h-7 w-7 shrink-0 text-brand-red', className)}
      fill="none"
      role={title ? 'img' : undefined}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <path d="M16 2.5 19.7 12.3 29.5 16l-9.8 3.7L16 29.5l-3.7-9.8L2.5 16l9.8-3.7L16 2.5Z" fill="currentColor" />
      <path d="M16 8.9 18.1 13.9l5 2.1-5 2.1-2.1 5-2.1-5-5-2.1 5-2.1L16 8.9Z" fill="var(--surface-base)" />
    </svg>
  );
}
