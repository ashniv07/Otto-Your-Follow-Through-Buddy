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
  const events = runner.runEphemeral({
    userId: "otto-system",
    newMessage: { role: "user", parts: [{ text: inputText }] },
  });

  for await (const event of events) {
    const text = event.content?.parts?.[0]?.text;
    if (text) finalText = text.trim();
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
