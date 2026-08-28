require("dotenv").config();
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
app.use("/", dashboardRoutes);

const PORT = process.env.PORT || 8080;
const SCHEDULER_INTERVAL_MS = Number(process.env.SCHEDULER_INTERVAL_MS) || 60_000;

app.listen(PORT, () => {
  console.log(`Otto backend listening on port ${PORT}`);

  // Runs on startup and then every SCHEDULER_INTERVAL_MS — this is what
  // replaces manually running testNotion.js. POST /run-now (used by the
  // frontend's "Run check now" button) still exists for an on-demand pass.
  const tick = () => {
    runSchedulerJob()
      .then((summary) => console.log("[scheduler]", JSON.stringify(summary)))
      .catch((err) => console.error("[scheduler] run failed:", err.message));
  };

  tick();
  setInterval(tick, SCHEDULER_INTERVAL_MS);
});
