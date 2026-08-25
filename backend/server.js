require("dotenv").config();
const crypto = require("crypto");
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
app.use(cookieParser());

// Anonymous "account" for the hackathon — no email/password. Every request
// gets a stable random id in an httpOnly cookie, which is what ties a
// browser to its Notion OAuth connection in notion_connections.
app.use((req, res, next) => {
  let userId = req.cookies?.otto_user_id;
  if (!userId) {
    userId = crypto.randomUUID();
    res.cookie("otto_user_id", userId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
  }
  req.userId = userId;
  next();
});

app.use("/", dashboardRoutes);
app.use("/api/auth", authRoutes);

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
