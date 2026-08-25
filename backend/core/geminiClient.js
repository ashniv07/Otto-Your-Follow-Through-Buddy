const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_AI_LOCATION || "global",
});

function stripCodeFences(text) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

// Calls Gemini with a prompt that must produce JSON, and safely parses the
// result. Throws a clear error (including the raw response) on parse failure.
async function generateJson(prompt) {
  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${prompt}\n\nRespond with ONLY valid JSON. Do not wrap it in markdown code fences and do not add any explanation before or after it.`,
  });

  const raw = result.text;
  if (!raw) {
    throw new Error("Gemini returned an empty response");
  }

  const cleaned = stripCodeFences(raw);
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Gemini did not return valid JSON. Raw response: ${raw}`);
  }
}

module.exports = { generateJson };
