import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

/**
 * ElevenLabs / Other tools will POST to /v1/chat/completions
 * in the OpenAI Chat format:
 * {
 *   "model": "gpt-3.5-turbo",
 *   "messages": [
 *     {"role": "system", "content": "..."},
 *     {"role": "user", "content": "..."} 
 *   ]
 * }
 */

app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { model, messages } = req.body;

    // Basic check for the last user message
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'No "messages" array provided.' });
    }
    // Find the user's most recent message
    const userMessageObj = messages.filter(m => m.role === 'user').pop();
    if (!userMessageObj) {
      return res.status(400).json({ error: 'No user message found in "messages".' });
    }
    const userMessage = userMessageObj.content;

    // Call the SHIZA Developer endpoint
    // (Customize 'prediction/XXXX...' with your actual endpoint)
    const shizaResp = await fetch(
      'https://developer.shiza.ai/api/v1/prediction/ab2cfad1-c3ab-4a7d-a9d9-6691f0172ff3',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage })
      }
    );
    const shizaData = await shizaResp.json();
    // Suppose SHIZA returns something like { answer: "Here is Will Smith's response." }
    // or possibly some other structure.

    // Build an OpenAI-style Chat Completion response
    const completionResponse = {
      id: 'chatcmpl-' + Math.random().toString(36).slice(2),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model || 'shiza-will-smith',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: shizaData.answer || JSON.stringify(shizaData)
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

    return res.json(completionResponse);
  } catch (error) {
    console.error('Error in chat completions proxy:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server on some port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('SHIZA-OpenAI Proxy running on port ' + PORT);
});
