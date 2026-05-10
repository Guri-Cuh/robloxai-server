const express = require("express");
const cors = require("cors");
const https = require("https");
const app = express();

app.use(cors());
app.use(express.json());

const sessions = {};

app.post("/push", (req, res) => {
  const { session, script } = req.body;
  if (!session || !script) return res.status(400).json({ error: "Missing session or script" });
  if (!sessions[session]) sessions[session] = [];
  sessions[session].push(script);
  res.json({ ok: true });
});

app.get("/pull/:session", (req, res) => {
  const { session } = req.params;
  const scripts = sessions[session] || [];
  sessions[session] = [];
  res.json({ scripts });
});

app.post("/ai", (req, res) => {
  const messages = req.body.messages || [];
  const userMessage = messages.map(m => m.content).join("\n");

  const systemPrompt = `You are RobloxAI, the world's best Roblox game developer and Luau expert.

ABSOLUTE RULES:
1. Every code response MUST have TWO scripts labeled clearly: SERVER SCRIPT and LOCAL SCRIPT.
2. NEVER tell the user to manually create anything in Explorer. Use Instance.new() for everything.
3. Server script: creates RemoteEvents in ReplicatedStorage, leaderstats, parts, server logic.
4. Local script: handles all GUI, button clicks, RemoteEvent firing.
5. Never set LocalScript.Source at runtime - always give two separate scripts.

GUI DESIGN:
- Dark frames: Color3.fromRGB(18, 18, 28)
- Accent buttons: Color3.fromRGB(0, 215, 120)  
- UICorner CornerRadius UDim.new(0, 10) on everything
- UIStroke borders Color3.fromRGB(40, 40, 60) thickness 1
- Fonts: GothamBold for buttons, Gotham for labels
- TweenService for all animations
- UIPadding for proper spacing

CODE QUALITY:
- Use task.wait() not wait()
- pcall() for DataStore
- game:GetService() for services
- Proper nil checks

FORMAT EXACTLY LIKE THIS:
Brief 1-2 sentence explanation.

SERVER SCRIPT:
<code>
-- server code here
</code>

LOCAL SCRIPT:
<code>
-- local code here
</code>

User: ${userMessage}`;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: systemPrompt }] }]
  });

  const key = process.env.GEMINI_API_KEY;
  const options = {
    hostname: "generativelanguage.googleapis.com",
    path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body)
    }
  };

  const apiReq = https.request(options, (apiRes) => {
    let data = "";
    apiRes.on("data", chunk => data += chunk);
    apiRes.on("end", () => {
      try {
        const parsed = JSON.parse(data);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
          || parsed.error?.message
          || "Could not generate a response.";
        res.json({ text });
      } catch(e) {
        res.status(500).json({ error: "Parse error" });
      }
    });
  });

  apiReq.on("error", (e) => res.status(500).json({ error: e.message }));
  apiReq.write(body);
  apiReq.end();
});

app.get("/", (req, res) => res.send("RobloxAI Server Running!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
