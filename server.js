import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic();

app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/ask', async (req, res) => {
  const { question } = req.body;
  if (!question?.trim()) {
    return res.status(400).json({ error: 'Question is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are a calm, warm guide who knows the Bhagavad Gita well. When someone asks a life question, find the most fitting verse and explain it through a simple story.

Format your response EXACTLY as valid JSON:
{
  "verse_ref": "BG 2.47",
  "sanskrit": "karmaṇy evādhikāras te mā phaleṣu kadācana",
  "translation": "You have a right to act, but never to the fruits of your actions.",
  "story": "A short, simple story (5 to 8 sentences) that makes the verse easy to understand. It can be about an everyday person, a farmer, a student, anyone relatable. The story should show the verse's meaning in action, not explain it. End with one sentence that gently links the story back to what the person asked. Use plain words. No em dashes."
}

Rules:
- The story must feel human and real, not like a fable or sermon.
- Short sentences. Everyday words only.
- Do not use em dashes (-- or —).
- Return ONLY the JSON, nothing else.`,
      messages: [{ role: 'user', content: question }],
    });

    let fullText = '';

    stream.on('text', (text) => {
      fullText += text;
      res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
    });

    stream.on('finalMessage', () => {
      res.write(`data: ${JSON.stringify({ done: true, full: fullText })}\n\n`);
      res.end();
    });

    stream.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

const PORT = 3131;
app.listen(PORT, () => {
  console.log(`Gita Advisor running at http://localhost:${PORT}`);
});
