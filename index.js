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

// Log all requests
app.use((req, res, next) => {
  console.log(`🔵 ${req.method} request to ${req.originalUrl}`);
  next();
});

app.post('/v1/chat/completions', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    console.log("❌ Missing Authorization header");
    return res.status(401).json({ error: 'Missing API token' });
  }

  const { model = "gpt-4-proxy", messages = [], prompt = "", stream = false } = req.body;

  // 🧠 Determine the user message source
  let lastUserMessage = "";

  if (Array.isArray(messages) && messages.length > 0) {
    const userMessages = messages.filter(msg => msg.role === 'user');
    lastUserMessage = userMessages[userMessages.length - 1]?.content?.trim() || "";
  }

  if (!lastUserMessage && typeof prompt === 'string' && prompt.trim().length > 0) {
    lastUserMessage = prompt.trim();
  }

  if (!lastUserMessage) {
    console.log("⚠️ No valid user message or prompt found, defaulting to fallback.");
    lastUserMessage = "Hello?";
  }

  console.log("📨 Final user message:", lastUserMessage);

  try {
    const flowiseResponse = await axios.post(FLOWISE_CHATFLOW_URL, {
      question: lastUserMessage
    });

    const rawReply = flowiseResponse.data.text || flowiseResponse.data.answer || "No response";
    const reply = String(rawReply).trim();

    console.log("💬 Flowise response:", reply);

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const words = reply.split(' ');
      for (const word of words) {
        res.write(`data: ${JSON.stringify({
          id: "chatcmpl-stream",
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              delta: { content: word + " " },
              finish_reason: null
            }
          ]
        })}\n\n`);
        await new Promise(r => setTimeout(r, 50));
      }

      res.write(`data: ${JSON.stringify({
        id: "chatcmpl-stream",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: "stop"
          }
        ]
      })}\n\n`);

      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      res.setHeader("Content-Type", "application/json");
      res.status(200).json({
        id: "chatcmpl-proxy",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
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
    }

    console.log("✅ Response sent");
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on port ${PORT}`);
});
