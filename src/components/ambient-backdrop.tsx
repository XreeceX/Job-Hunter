/**
 * Decorative layers only — pointer-events none, aria-hidden.
 * Motion is toned down when prefers-reduced-motion is set (see globals.css).
 */
export function AmbientBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="ambient-aurora ambient-aurora-a" />
      <div className="ambient-aurora ambient-aurora-b" />
      <div className="ambient-grid" />
      <div className="ambient-noise" />
    </div>
  );
}
