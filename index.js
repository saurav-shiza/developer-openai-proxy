import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { model, messages } = req.body || {};

    // 1. Extract user prompt
    let userMessage = '';
    if (Array.isArray(messages)) {
      const userMsgObj = messages.filter(m => m.role === 'user').pop();
      if (userMsgObj?.content) {
        userMessage = userMsgObj.content.trim();
      }
    }
    if (!userMessage) {
      userMessage = 'Hello from a default prompt!';
    }

    // 2. Call the SHIZA Developer endpoint with { question: userMessage }
    const response = await fetch(
      'https://developer.shiza.ai/api/v1/prediction/ab2cfad1-c3ab-4a7d-a9d9-6691f0172ff3',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage })
      }
    );
    const shizaData = await response.json();

    // 3. Parse out the final bot message from the "messages" array
    let assistantText = "No bot messages found.";
    if (Array.isArray(shizaData.messages)) {
      const botMsgObj = shizaData.messages.filter(m => m.role === 'bot').pop();
      if (botMsgObj && botMsgObj.content) {
        assistantText = botMsgObj.content;
      }
    }

    // 4. Return an OpenAI Chat Completions–style response
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OpenAI-style proxy listening on port ${PORT}`);
});
