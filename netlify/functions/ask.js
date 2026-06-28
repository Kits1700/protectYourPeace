import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const { question, mode = 'brief', answers = [] } = body;

  if (!question?.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Question is required' }) };
  }

  try {
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

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: userContent }],
    });

    const raw = message.content[0].text;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: match[0],
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
