// Lazily loaded — dynamic import lets CJS code consume the ESM @google/adk bundle.
let _adk = null;
async function loadAdk() {
  if (!_adk) _adk = await import("@google/adk");
  return _adk;
}

/**
 * Run an already-constructed LlmAgent with a single text prompt and return
 * the agent's final text response.
 */
async function runLlmAgent(agent, inputText) {
  const { InMemoryRunner, InMemorySessionService } = await loadAdk();

  const sessionService = new InMemorySessionService();
  const runner = new InMemoryRunner({ agent, appName: "otto", sessionService });

  let finalText = "";
  let lastError = null;
  const events = runner.runEphemeral({
    userId: "otto-system",
    newMessage: { role: "user", parts: [{ text: inputText }] },
  });

  for await (const event of events) {
    // A failed call (rate limit, quota, auth, etc.) doesn't throw here — the
    // ADK yields an event with errorCode/errorMessage set and no content
    // instead. Previously that fell straight through to an empty finalText,
    // which callers then tried to JSON.parse — surfacing as a baffling
    // "Unexpected end of JSON input" with the real reason nowhere in the logs.
    if (event.errorCode || event.errorMessage) {
      lastError = `${event.errorCode || "unknown"}: ${event.errorMessage || "no message"}`;
      continue;
    }
    const text = event.content?.parts?.[0]?.text;
    if (text) finalText = text.trim();
  }

  if (!finalText && lastError) {
    throw new Error(`Gemini call failed (${lastError})`);
  }

  return finalText;
}

/**
 * Same as runLlmAgent but strips markdown code fences and JSON-parses the
 * result. Throws if the response is not valid JSON.
 */
async function runLlmAgentJson(agent, inputText) {
  const text = await runLlmAgent(agent, inputText);
  const clean = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(clean);
}

module.exports = { loadAdk, runLlmAgent, runLlmAgentJson };
