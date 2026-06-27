import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are a calm, warm guide who knows the Bhagavad Gita well. When someone asks a life question, find the most fitting verse and explain it through a simple story.

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
- Return ONLY the JSON, nothing else.`;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let question;
  try {
    ({ question } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  if (!question?.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Question is required' }) };
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: 'user', content: question }],
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
