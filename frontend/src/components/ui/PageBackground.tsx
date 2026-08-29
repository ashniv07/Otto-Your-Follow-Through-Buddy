/**
 * Flat backdrop for the app shell. No glow, no gradients. Rendered once by
 * Dashboard.tsx as a fixed layer behind Header/main — that means it's a
 * sibling of LoopsPage, not a descendant, so LoopsPage's own `.google-theme`
 * scoping (see index.css) can't reach it through the DOM. `google` lets the
 * one tab that's currently Google-themed paint its own backdrop instead.
 */
export function PageBackground({ google = false }: { google?: boolean }) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 -z-10 bg-base-950 ${google ? "google-theme" : ""}`}
    />
  );
}