/** Shared surface motion — keep subtle; respects reduced-motion via Tailwind. */
export const interactiveCardClass =
  'transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-[var(--border-hover)] hover:shadow-glow motion-reduce:transition-none motion-reduce:hover:translate-y-0';
