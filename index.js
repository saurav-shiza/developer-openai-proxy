import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

// Example route that mimics OpenAI's Chat Completions endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { model, messages } = req.body;

    // Validate 'messages' array
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'No "messages" array provided.' });
    }

    // Find the user's most recent message
    const userMessageObj = messages.filter(m => m.role === 'user').pop();
    if (!userMessageObj) {
      return res.status(400).json({ error: 'No user message found in "messages".' });
    }
    const userMessage = userMessageObj.content;

    // Make the request to your SHIZA Developer endpoint
    // Replace this with your actual SHIZA endpoint if needed
    const shizaEndpoint = 'https://developer.shiza.ai/api/v1/prediction/ab2cfad1-c3ab-4a7d-a9d9-6691f0172ff3';
    const shizaResp = await fetch(shizaEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: userMessage }),
    });

    // Suppose SHIZA returns something like:
    // {
    //   "text": "The smoke test has passed.",
    //   "question": "Hello from Postman!",
    //   "chatId": "...",
    //   ...
    // }
    const shizaData = await shizaResp.json();

    // If shizaData has a 'text' field, use that. Otherwise:
    // - if it's a string, return that
    // - else fallback to JSON-stringifying the entire object
    let finalContent;
    if (typeof shizaData === 'object' && shizaData.text) {
      finalContent = shizaData.text;
    } else if (typeof shizaData === 'string') {
      finalContent = shizaData;
    } else {
      finalContent = JSON.stringify(shizaData);
    }

    // Build an OpenAI-style Chat Completion response
    const completionResponse = {
      id: 'chatcmpl-' + Math.random().toString(36).slice(2),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model || 'shiza-custom-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: finalContent,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };

    // Return the JSON response
    return res.json(completionResponse);
  } catch (error) {
    console.error('Error in chat completions proxy:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Start listening
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('SHIZA-OpenAI Proxy running on port ' + PORT);
});
