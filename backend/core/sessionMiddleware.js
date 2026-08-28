const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Browser-navigated routes (the user clicks a link / gets redirected here by
// Google or Notion) — on a missing/invalid session these should bounce back
// to the landing page rather than show a raw JSON 401.
const REDIRECT_ON_MISSING_SESSION = new Set([
  "/google/connect",
  "/google/callback",
  "/notion/connect",
  "/notion/callback",
]);

// Reads the signed `otto_session` cookie set by the Google sign-in callback
// (see authRoutes.js) and sets req.userId. Every route this guards requires
// the user to be signed in to Otto — separate from having connected Gmail/
// Calendar/Docs/Drive or Notion, which is a per-adapter opt-in on top of this.
function requireSession(req, res, next) {
  const userId = req.signedCookies?.otto_session;
  if (userId) {
    req.userId = userId;
    return next();
  }

  if (REDIRECT_ON_MISSING_SESSION.has(req.path)) {
    return res.redirect(`${FRONTEND_URL}/?error=signin_required`);
  }
  res.status(401).json({ error: "Not signed in" });
}

module.exports = { requireSession };
