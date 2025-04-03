import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

app.post('/v1/chat/completions', async (req, res) => {
  try {
    // Typically: { model, messages, stream } for an OpenAI-style request
    const { model, messages } = req.body || {};

    // Find the user's last message if it exists
    let userMessage = '';
    if (Array.isArray(messages)) {
      const userMsgObj = messages.filter(m => m.role === 'user').pop();
      if (userMsgObj?.content) {
        userMessage = userMsgObj.content.trim();
      }
    }

    // If there's no user message or it's empty, set a default
    if (!userMessage) {
      userMessage = 'Hello from a default prompt!';
    }

    // ---- Call your SHIZA Developer endpoint with the userMessage ----
    const response = await fetch(
      'https://developer.shiza.ai/api/v1/prediction/ab2cfad1-c3ab-4a7d-a9d9-6691f0172ff3',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage })
      }
    );
    const shizaData = await response.json();

    // Suppose SHIZA returns something like { text: "some answer", ... } or
    // { answer: "some answer", question: "..." }
    // We'll pick whichever field you want for the final "assistant" content.

    const assistantText = shizaData.text
      || shizaData.answer
      || "No 'answer' or 'text' field returned by SHIZA.";

    // Build an OpenAI Chat Completions JSON response
    const chatCompletion = {
      id: 'chatcmpl-' + Math.random().toString(36).slice(2),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model || 'shiza-proxy-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            // Return the plain text so it doesn't show up as escaped JSON
            content: assistantText
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };

    return res.json(chatCompletion);

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message || error
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OpenAI-style proxy listening on port ${PORT}`);
});
