export function Footer() {
  return (
    <footer className="px-6 pb-10 sm:px-9 lg:px-12 xl:px-16" id="about">
      <div className="mx-auto flex max-w-[90rem] justify-center border-t border-line pt-8">
        <div className="inline-flex items-center gap-3 rounded-full border border-status/35 bg-status/5 px-6 py-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-status shadow-[0_0_2.5rem_-1rem_var(--status-online)]">
          <span aria-hidden="true" className="h-2.5 w-2.5 animate-pulse rounded-full bg-status" />
          System online
        </div>
      </div>
    </footer>
  );
}
