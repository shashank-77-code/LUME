import type { ReactNode } from 'react';

export interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return <main className="relative isolate overflow-hidden">{children}</main>;
}
