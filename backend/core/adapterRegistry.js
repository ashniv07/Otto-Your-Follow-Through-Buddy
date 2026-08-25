// Single place that maps adapter name -> adapter module, so schedulerJob
// (and anything else) can call any adapter identically without knowing
// which teammate built it.
module.exports = {
  notion: require("../adapters/notion/adapter"),
  gmail: require("../adapters/gmail/adapter"),
  calendar: require("../adapters/calendar/adapter"),
};
