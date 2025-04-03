import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { model, messages } = req.body || {};

    // 1) Extract user prompt from the request
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

    // 2) POST to your SHIZA Developer endpoint
    const shizaResponse = await fetch(
      'https://developer.shiza.ai/api/v1/prediction/ab2cfad1-c3ab-4a7d-a9d9-6691f0172ff3',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage })
      }
    );

    // 3) The returned data is an array of conversation objects.
    const shizaData = await shizaResponse.json();
    // Example shape: [ { id, source, messages: [ {role, content}, ... ] }, ... ]

    let assistantText = '';

    // If we got an array, pick the last conversation,
    // then pick the last 'bot' message in that conversation.
    if (Array.isArray(shizaData) && shizaData.length > 0) {
      const lastConversation = shizaData[shizaData.length - 1];
      if (lastConversation && Array.isArray(lastConversation.messages)) {
        const botMsgObj = lastConversation.messages.filter(m => m.role === 'bot').pop();
        if (botMsgObj && botMsgObj.content) {
          assistantText = botMsgObj.content;
        }
      }
    }

    // If we still didn't find any text, let's set a fallback message:
    if (!assistantText) {
      assistantText = "No bot messages found in the last conversation.";
    }

    // 4) Return an OpenAI chat completions–style response
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
