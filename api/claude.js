// Vercel Serverless Function — proxies Claude API calls
// Runs server-side: no CORS issues, API key stays secret.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not set in Vercel env vars" });
  }

  try {
    const { prompt, type } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    console.log(`[proxy] type=${type}, prompt=${prompt.length} chars`);

    const body = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
          user_location: {
            type: "approximate",
            city: "Lynn",
            region: "Massachusetts",
            country: "US",
            timezone: "America/New_York",
          },
        },
      ],
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[proxy] Anthropic ${response.status}: ${responseText}`);
      return res.status(response.status).json({
        error: `Anthropic API ${response.status}`,
        details: responseText,
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("[proxy] Failed to parse response:", responseText.slice(0, 500));
      return res.status(500).json({ error: "Invalid JSON from Anthropic" });
    }

    // Extract ALL text blocks
    const textParts = [];
    if (data.content && Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === "text" && block.text) {
          textParts.push(block.text);
        }
      }
    }

    const text = textParts.join("\n");
    const searchCount = data.usage?.server_tool_use?.web_search_requests || 0;

    console.log(`[proxy] OK: ${text.length} chars, ${data.content?.length || 0} blocks, ${searchCount} searches, stop=${data.stop_reason}`);

    return res.status(200).json({
      text,
      stop_reason: data.stop_reason,
      usage: data.usage,
      search_count: searchCount,
    });
  } catch (err) {
    console.error("[proxy] Error:", err.message, err.stack);
    return res.status(500).json({ error: "Server error", message: err.message });
  }
}
