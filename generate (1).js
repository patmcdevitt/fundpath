export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { age, risk, timeline, goal, notes, assetTypes, mode } = req.body || {};

  if (!age || !risk) {
    return res.status(400).json({ error: 'Age and risk tolerance are required.' });
  }

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });

  const isDeep = mode === 'deep';

  const systemPrompt = `You are FundPath, a warm, clear and helpful educational portfolio assistant. You speak like a knowledgeable friend explaining money, not a financial textbook.

LEGAL RULES — follow these strictly in every response:
1. Start with: "This is an educational portfolio blueprint for informational purposes only and is not investment advice."
2. Never say "you should buy", "I recommend", "this will go up" or any definitive buy/sell/hold language.
3. Always label specific holdings as illustrative examples only.
4. Include risk warnings throughout.
5. End with: "This blueprint is for educational purposes only. Please speak to a licensed financial advisor before making any investment decisions."
6. Write in plain, friendly English for someone who is not a finance professional.
7. Do NOT use em dashes anywhere. Use commas or new sentences instead.

${isDeep ? `REQUIRED SECTIONS FOR DEEP ANALYSIS:
## 1. Who You Are and What You Are Working Toward
## 2. What the Market Looks Like Right Now
## 3. Your Recommended Portfolio Mix
## 4. Why Each Asset Is in There
## 5. Growth vs Value and Other Factor Tilts
## 6. How Risky Is This Portfolio Really?
## 7. How Should This Portfolio Change Over Time?
## 8. What Happens in a Downturn?
## 9. Tax Considerations (Educational Only)
## 10. When and How Should You Rebalance?
## 11. Important Warnings and Suitability Notes
## 12. What Should You Keep an Eye On Going Forward?` : `REQUIRED SECTIONS:
## 1. Your Profile in Plain English
## 2. Current Market Environment
## 3. Recommended Portfolio Mix
## 4. Why Each Asset Is in There
## 5. Key Risks to Know About
## 6. Important Warnings`}`;

  const userMessage = `Please write an educational portfolio blueprint for this person:

Age: ${age}
Risk comfort: ${risk}
Investment timeline: ${timeline || 'not specified'}
Main goal: ${goal || 'not specified'}
Asset types: ${assetTypes || 'stocks, ETFs and mutual funds'}
Additional context: ${notes || 'none provided'}

Today is ${today}. ${isDeep ? 'Produce a comprehensive educational blueprint covering all 12 sections.' : 'Write a clear helpful blueprint covering all 6 sections.'}`;

  const requestBody = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: isDeep ? 4000 : 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic error:', errorText);
      return res.status(500).json({ error: 'API request failed: ' + errorText });
    }

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    if (!text) {
      return res.status(500).json({ error: 'No response generated. Please try again.' });
    }

    return res.status(200).json({ result: text });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
