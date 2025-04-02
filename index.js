const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const FLOWISE_CHATFLOW_URL = "https://developer.shiza.ai/api/v1/prediction/ab2cfad1-c3ab-4a7d-a9d9-6691f0172ff3";

// Health check route
app.get('/', (req, res) => {
  res.send('✅ Flowise proxy is live');
});

// Global logger for all routes
app.use((req, res, next) => {
  console.log(`🔵 ${req.method} request to ${req.originalUrl}`);
  next();
});

app.post('/v1/chat/completions', async (req, res) => {
  // Require Authorization header (Play.ai expects this)
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    console.log("❌ Missing Authorization header");
    return res.status(401).json({ error: 'Missing API token' });
  }

  console.log("✅ API token received:", token);

  try {
    const messages = req.body.messages || [];
    const userMessage = messages.length
      ? messages[messages.length - 1].content
      : req.body.question || "Hello?";

    console.log("📨 Incoming message:", userMessage);

    const flowiseResponse = await axios.post(FLOWISE_CHATFLOW_URL, {
      question: userMessage
    });

    console.log("💬 Flowise raw response:", flowiseResponse.data);

    const reply =
      flowiseResponse.data.text ||
      flowiseResponse.data.answer ||
      flowiseResponse.data.response ||
      JSON.stringify(flowiseResponse.data) ||
      "No response";

    console.log("🟢 Final reply being sent to Play.ai:", reply);

    res.json({
      id: "chatcmpl-proxy",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "gpt-4-proxy",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: reply
          },
          finish_reason: "stop"
        }
      ]
    });
  } catch (err) {
    console.error("❌ Proxy error:", err.message);
    res.status(500).json({
      error: {
        message: "Proxy error",
        details: err.message
      }
    });
  }
});

// Use Render-assigned port
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`✅ Proxy server running on port ${PORT}`);
});
