/**
 * Backdrop for the app shell. A faint dot-grid texture (same motif as the
 * landing page's floating-card containers) gives the dashboard some of the
 * reference template's tactile, "on a surface" feel — kept at low opacity
 * and faded out toward the edges so it reads as texture, not noise, and
 * never competes with the real approve/decline data sitting on top of it.
 */
export function PageBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-base-950">
      <div
        className="dot-grid absolute inset-0 opacity-40"
        style={{
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 90%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 90%)",
        }}
      />
    </div>
  );
}
