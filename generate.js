export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { age, risk, timeline, goal, notes, assetTypes, mode } = req.body;

  if (!age || !risk) return res.status(400).json({ error: 'Age and risk tolerance are required.' });

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const isDeep = mode === 'deep';

  const deepSections = isDeep ? `
## 1. Who You Are and What You Are Working Toward
## 2. What the Market Looks Like Right Now
Search the web for current interest rates, inflation data, equity market conditions and sector trends as of today (${today}). Summarise this in plain English.
## 3. Your Recommended Portfolio Mix
## 4. Why Each Asset Is in There
## 5. Growth vs Value and Other Factor Tilts
## 6. How Risky Is This Portfolio Really?
## 7. How Should This Portfolio Change Over Time?
## 8. What Happens in a Downturn? (Scenario Analysis)
Cover recession, inflation spike, interest rate cuts, tech correction and energy shock.
## 9. Tax Considerations (Educational Only)
## 10. When and How Should You Rebalance?
## 11. Important Warnings and Suitability Notes
## 12. What Should You Keep an Eye On Going Forward?` : `
## 1. Your Profile in Plain English
## 2. Current Market Environment (2 to 3 sentences)
## 3. Recommended Portfolio Mix
## 4. Why Each Asset Is in There
## 5. Key Risks to Know About
## 6. Important Warnings`;

  const systemPrompt = `You are FundPath, a warm, clear and helpful educational portfolio assistant. You speak like a knowledgeable friend explaining money, not a financial textbook.

LEGAL RULES (follow strictly):
1. Start with: "This is an educational portfolio blueprint for informational purposes only and is not investment advice."
2. Never say "you should buy", "I recommend", "this will go up" or any definitive buy/sell/hold language.
3. Always label example holdings as illustrative examples only.
4. Include risk warnings throughout.
5. End with: "This blueprint is for educational purposes only. Please speak to a licensed financial advisor before making any investment decisions."
6. Write clearly for someone who is not a finance professional. Friendly, plain English throughout.
7. Do NOT use em dashes. Use commas, full stops or new sentences instead.
${isDeep ? '8. You have web search available. Search for current market conditions before writing the plan.\n' : ''}
REQUIRED SECTIONS:
${deepSections}`;

  const userMessage = `Please write an educational portfolio blueprint for this person:

Age: ${age}
Risk comfort: ${risk}
How long they are investing: ${timeline || 'not specified'}
Their main goal: ${goal || 'not specified'}
Asset types they want: ${assetTypes || 'stocks, ETFs and mutual funds'}
Extra context: ${notes || 'nothing extra provided'}

${isDeep ? `Start by searching the web for current market conditions as of ${today}, then use that context throughout.` : 'Keep it clear and helpful. Write for someone who is new to investing.'}`;

  const body = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  };

  if (isDeep) body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return res.status(200).json({ result: text });

  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Failed to generate blueprint. Please try again.' });
  }
}
