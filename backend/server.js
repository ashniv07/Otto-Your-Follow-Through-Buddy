require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dashboardRoutes = require("./api/dashboardRoutes");
const authRoutes = require("./api/authRoutes");
const { runSchedulerJob } = require("./core/schedulerJob");

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

const COOKIE_SECRET = process.env.COOKIE_SECRET;
if (!COOKIE_SECRET) {
  throw new Error("COOKIE_SECRET env var is required (used to sign the sign-in session cookie)");
}
app.use(cookieParser(COOKIE_SECRET));

// Every request needs a real signed-in Otto account (see authRoutes.js
// google/signin) — no more anonymous per-browser accounts. The guard is
// applied inside dashboardRoutes/authRoutes themselves (not here). Order
// matters here: authRoutes (mounted at the specific prefix "/api/auth") is
// registered BEFORE dashboardRoutes (mounted at "/", which — being a prefix
// of literally every path — would otherwise intercept /api/auth/* requests
// first and never let them reach authRoutes at all).
app.use("/api/auth", authRoutes);
app.use("/api", dashboardRoutes);

// Serves the built frontend (frontend/dist, produced at Docker build time —
// see Dockerfile) so one Cloud Run service handles both the API and the
// site. Only present in the deployed container; a plain `node server.js`
// in local dev (no dist/) just skips this and stays API-only, same as
// before — the frontend is served separately by `npm run frontend`.
const FRONTEND_DIST = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  // Anything reaching this point already fell through authRoutes and
  // dashboardRoutes above (registered first — Express tries routes in
  // order) and express.static just tried and failed to find a matching
  // file. That means it's a client-side (react-router) path like /app, not
  // a missed API route — serve index.html and let the client render it.
  app.use((req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

const PORT = process.env.PORT || 8080;
const SCHEDULER_INTERVAL_MS = Number(process.env.SCHEDULER_INTERVAL_MS) || 60_000;

app.listen(PORT, () => {
  console.log(`Otto backend listening on port ${PORT}`);

  // Runs on startup and then every SCHEDULER_INTERVAL_MS — this is what
  // replaces manually running testNotion.js. POST /run-now (used by the
  // frontend's "Run check now" button) still exists for an on-demand pass.
  //
  // A real tick (real inbox, real Gemini calls per email/comment/task) can
  // easily take several minutes — much longer than SCHEDULER_INTERVAL_MS.
  // setInterval doesn't know that: it fires again unconditionally every
  // interval regardless of whether the previous tick finished, so ticks
  // stack up and run concurrently — N-way duplicate Gmail scans and Gemini
  // calls, all billing at once, growing without bound the longer the
  // process stays up (this is very likely why usage/cost has been so much
  // higher than "one classify pass per inbox per interval" would suggest).
  // scheduleNext() below waits for the current run to actually finish
  // before arming the next timer, so at most one tick ever runs at a time.
  let running = false;
  const tick = () => {
    if (running) {
      console.warn("[scheduler] Previous tick still running — skipping this interval to avoid overlap.");
      return;
    }
    running = true;
    runSchedulerJob()
      .then((summary) => console.log("[scheduler]", JSON.stringify(summary)))
      .catch((err) => console.error("[scheduler] run failed:", err.message))
      .finally(() => { running = false; });
  };

  tick();
  setInterval(tick, SCHEDULER_INTERVAL_MS);
});
