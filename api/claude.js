export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3,
          user_location: { type: "approximate", city: "Lynn", region: "Massachusetts", country: "US", timezone: "America/New_York" },
        }],
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      console.error(`[proxy] ${response.status}: ${raw.slice(0, 300)}`);
      return res.status(response.status).json({ error: `API ${response.status}`, details: raw.slice(0, 500) });
    }

    const data = JSON.parse(raw);
    const text = (data.content || []).filter(b => b.type === "text" && b.text).map(b => b.text).join("\n");
    return res.status(200).json({ text, searches: data.usage?.server_tool_use?.web_search_requests || 0 });
  } catch (err) {
    console.error("[proxy]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
