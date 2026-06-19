import { GoogleGenAI } from "@google/genai";
async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const models = await ai.models.list();
  for await (const model of models) {
    if (model.name.includes("gemini")) {
      console.log(model.name);
    }
  }
}
run().catch(console.error);
