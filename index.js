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

    // 3) The returned data is an array of conversation objects
    const shizaData = await shizaResponse.json();
    // shape: [
    //   {
    //     "id": "some-uuid",
    //     "messages": [
    //       { "role": "user", "content": "..." },
    //       { "role": "bot",  "content": "..." }
    //     ]
    //   },
    //   ...
    // ]

    let assistantText = '';

    // Step A: Filter for conversations that contain userMessage
    // in a "user" role. Some conversations may have the same question,
    // so we filter them all, then pick the last match.
    const matchingConversations = shizaData.filter(conv => {
      if (!conv.messages) return false;
      // Check if *any* user message matches "userMessage" exactly
      return conv.messages.some(
        m => m.role === 'user' && m.content.trim() === userMessage
      );
    });

    // Step B: Pick the last matching conversation
    if (matchingConversations.length > 0) {
      const lastMatch = matchingConversations[matchingConversations.length - 1];
      // Step C: In that conversation, pick the last 'bot' message
      const botMsgObj = lastMatch.messages.filter(m => m.role === 'bot').pop();
      if (botMsgObj && botMsgObj.content) {
        assistantText = botMsgObj.content;
      }
    }

    // Fallback if nothing matched
    if (!assistantText) {
      assistantText = "No bot messages found matching this user prompt.";
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
