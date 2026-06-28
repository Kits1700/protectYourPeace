import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic();

app.use(express.json());
app.use(express.static(__dirname));

const BRIEF_SYSTEM = `You are a calm, warm guide who knows the Bhagavad Gita well. When someone asks a life question, find the most fitting verse and explain it through a simple story.

Format your response EXACTLY as valid JSON:
{
  "verse_ref": "BG 2.47",
  "sanskrit": "karmaṇy evādhikāras te mā phaleṣu kadācana",
  "translation": "You have a right to act, but never to the fruits of your actions.",
  "story": "A short, simple story (5 to 8 sentences) that makes the verse easy to understand. About an everyday person. The story shows the verse in action. End with one sentence linking it back to the person's question. Plain words only. No em dashes."
}

Rules: Short sentences. Everyday words. No em dashes. Return ONLY the JSON.`;

const FOLLOWUP_SYSTEM = `You are a calm guide who asks good questions to understand someone better before giving Gita wisdom.

Given their question or situation, return exactly 2 short follow-up questions that will help you give them a much more personal and useful answer.

Format as JSON:
{
  "questions": [
    "First question here?",
    "Second question here?"
  ]
}

Rules:
- Questions should be warm, curious, not clinical.
- Short. One sentence each.
- Ask about feelings, context, or what they have already tried.
- No em dashes. Return ONLY the JSON.`;

const DEEP_SYSTEM = `You are a calm, warm guide who knows the Bhagavad Gita well. You have asked follow-up questions and now have enough context to give a deep, personal response.

Format your response EXACTLY as valid JSON:
{
  "verse_ref": "BG 2.47",
  "sanskrit": "karmaṇy evādhikāras te mā phaleṣu kadācana",
  "translation": "You have a right to act, but never to the fruits of your actions.",
  "story": "A short story (5 to 8 sentences) that shows the verse in action. Everyday person. Real feeling. End with one line linking back to their situation.",
  "deeper": "Two paragraphs that go deeper. Use what they shared in their answers to make this personal. Connect the verse's teaching directly to their specific situation. Be honest and warm, not preachy.",
  "practice": "One simple, concrete thing they can do or notice today. One or two sentences. Grounded and doable."
}

Rules: Plain words. Short sentences. No em dashes. Make it feel written for them specifically. Return ONLY the JSON.`;

app.post('/.netlify/functions/ask', async (req, res) => {
  const { question, mode = 'brief', answers = [] } = req.body;

  if (!question?.trim()) {
    return res.status(400).json({ error: 'Question is required' });
  }

  let system, userContent;

  if (mode === 'followup') {
    system = FOLLOWUP_SYSTEM;
    userContent = question;
  } else if (mode === 'deep') {
    system = DEEP_SYSTEM;
    const answerBlock = answers.map(({ q, a }) => `Q: ${q}\nA: ${a}`).join('\n\n');
    userContent = `Their situation: ${question}\n\nFollow-up answers:\n${answerBlock}`;
  } else {
    system = BRIEF_SYSTEM;
    userContent = question;
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: userContent }],
    });

    const raw = message.content[0].text;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');

    res.json(JSON.parse(match[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3131;
app.listen(PORT, () => {
  console.log(`Gita Advisor running at http://localhost:${PORT}`);
});
