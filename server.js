const express = require("express");
const cors = require("cors");
const https = require("https");
const app = express();

app.use(cors());
app.use(express.json());

// Store pending scripts per session
const sessions = {};

// Website posts a script here
app.post("/push", (req, res) => {
  const { session, script } = req.body;
  if (!session || !script) return res.status(400).json({ error: "Missing session or script" });
  if (!sessions[session]) sessions[session] = [];
  sessions[session].push(script);
  res.json({ ok: true });
});

// Studio plugin polls here for new scripts
app.get("/pull/:session", (req, res) => {
  const { session } = req.params;
  const scripts = sessions[session] || [];
  sessions[session] = [];
  res.json({ scripts });
});

// Proxy AI requests to Gemini
app.post("/ai", (req, res) => {
  const userMessage = req.body.messages.map(m => m.content).join("\n");

  const body = JSON.stringify({
    contents: [{
      parts: [{
        text: `You are RobloxAI, an expert Roblox game developer and Luau programmer.
Your job is to help users build Roblox games by writing SELF-CONTAINED Luau scripts.

CRITICAL RULES:
1. ALWAYS write ONE single script that builds everything automatically - GUIs, parts, folders, RemoteEvents, leaderstats - all created via Instance.new(), never tell the user to manually create things in Explorer.
2. Scripts go in ServerScriptService. Use Instance.new() to create all objects including GUIs inside StarterGui.
3. Keep explanations to 2-3 sentences max.
4. ALWAYS wrap the complete Luau script in <code> tags:
<code>
-- your Luau code here
</code>

User: ${userMessage}`
      }]
    }]
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
        console.log("Gemini response:", JSON.stringify(parsed).slice(0, 500));
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || parsed.error?.message || "Sorry, I could not generate a response.";
        res.json({ text });
      } catch(e) {
        console.log("Raw Gemini data:", data.slice(0, 500));
        res.status(500).json({ error: "Parse error" });
      }
    });
  });

  apiReq.on("error", (e) => res.status(500).json({ error: e.message }));
  apiReq.write(body);
  apiReq.end();
});

// Health check
app.get("/", (req, res) => res.send("RobloxAI Server Running!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
