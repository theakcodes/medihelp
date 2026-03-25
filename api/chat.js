import { Buffer } from "buffer";

const GROQ_API_KEY  = process.env.GROQ_API_KEY;
const TEXT_MODEL    = "llama-3.3-70b-versatile";
const VISION_MODEL  = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_URL      = "https://api.groq.com/openai/v1/chat/completions";

async function groq(messages, model = TEXT_MODEL, maxTokens = 4096) {
  const r = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model, temperature: 0.3, max_tokens: maxTokens, messages }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
  return d.choices?.[0]?.message?.content || "";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { route, systemPrompt, userMessage, imageBase64, mimeType, pdfBase64, messages } = req.body;

  try {
    // ── health check ──────────────────────────────────────────────
    if (route === "health") {
      return res.json({ status: "ok", keySet: !!GROQ_API_KEY });
    }

    // ── analyze text ──────────────────────────────────────────────
    if (route === "analyze") {
      if (!systemPrompt || !userMessage)
        return res.status(400).json({ error: "Missing systemPrompt or userMessage" });
      const text = await groq([
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMessage  },
      ]);
      return res.json({ text });
    }

    // ── analyze image ─────────────────────────────────────────────
    if (route === "analyze-image") {
      if (!systemPrompt || !imageBase64)
        return res.status(400).json({ error: "Missing systemPrompt or imageBase64" });
      const text = await groq([
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` } },
            { type: "text", text: "This is the medical report image. Analyse it and return JSON as instructed." },
          ],
        },
      ], VISION_MODEL);
      return res.json({ text });
    }

    // ── analyze PDF ───────────────────────────────────────────────
    if (route === "analyze-pdf") {
      if (!systemPrompt || !pdfBase64)
        return res.status(400).json({ error: "Missing systemPrompt or pdfBase64" });
      const { default: pdfjsLib } = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const buffer = Buffer.from(pdfBase64, "base64");
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      let pdfText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent();
        pdfText += content.items.map((item) => item.str).join(" ") + "\n";
      }
      if (!pdfText.trim() || pdfText.length < 10)
        return res.status(400).json({ error: "Could not extract text from PDF. Try uploading a photo instead." });
      const text = await groq([
        { role: "system", content: systemPrompt },
        { role: "user",   content: "MEDICAL REPORT (from PDF):\n" + pdfText },
      ]);
      return res.json({ text });
    }

    // ── AI chat ───────────────────────────────────────────────────
    if (route === "chat") {
      if (!messages || !Array.isArray(messages))
        return res.status(400).json({ error: "Missing messages array" });
      const text = await groq(messages, TEXT_MODEL, 600);
      return res.json({ text });
    }

    return res.status(400).json({ error: "Unknown route" });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}