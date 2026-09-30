function Key({ children }: { readonly children: string }) {
  return (
    <kbd className="rounded-[5px] border border-line-strong border-b-2 bg-surface px-1.5 py-px text-[0.68rem] font-semibold text-ink-soft">
      {children}
    </kbd>
  )
}

/** One-line reminder of the controls under the board, for mouse and keyboard players. */
export function ControlsHint() {
  return (
    <p className="mt-2.5 hidden flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[0.74rem] text-subtle pointer-fine:flex">
      <span>Click to build</span>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1.5">
        Right-click or <Key>Space</Key> to turn
      </span>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1.5">
        <Key>P</Key> pause
      </span>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1.5">
        <Key>M</Key> sound
      </span>
    </p>
  )
}
