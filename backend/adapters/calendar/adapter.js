// Stub placeholder — Person 3 builds the real Calendar adapter here.
// Keeps the same shape as every other adapter so schedulerJob can call it
// identically once it's implemented.
module.exports = {
  async fetchNewItems() {
    return [];
  },
  async recheck(loop) {
    return loop.current_state;
  },
};
