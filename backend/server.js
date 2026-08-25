require("dotenv").config();
const express = require("express");
const cors = require("cors");
const dashboardRoutes = require("./api/dashboardRoutes");
const { runSchedulerJob } = require("./core/schedulerJob");

const app = express();
app.use(cors());
app.use(express.json());
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
