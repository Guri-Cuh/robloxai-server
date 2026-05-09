const express = require("express");
const cors = require("cors");
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
  sessions[session] = []; // Clear after sending
  res.json({ scripts });
});

// Health check
app.get("/", (req, res) => res.send("RobloxAI Server Running!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
