const https = require('https');

module.exports = async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { age, risk, timeline, goal, notes, assetTypes, mode } = req.body || {};
  if (!age || !risk) return res.status(400).json({ error: 'Age and risk tolerance are required.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured.' });

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const isDeep = mode === 'deep';

  const systemPrompt = `You are FundPath, a warm and helpful educational portfolio assistant.

You must respond with ONLY a valid JSON object. No text before or after. No markdown code blocks. Just raw JSON.

The JSON must follow this exact structure:
{
  "profile_summary": "2-3 sentence plain English summary of this person's situation and goals",
  "market_context": "2-3 sentences on current market conditions as of ${today}",
  "allocation": [
    { "name": "US equities", "pct": 50, "color": "#1A6B4A" },
    { "name": "International", "pct": 20, "color": "#2E9B6E" },
    { "name": "Bonds", "pct": 15, "color": "#6DCBA0" },
    { "name": "REITs", "pct": 10, "color": "#C2EDD9" },
    { "name": "Cash", "pct": 5, "color": "#D4D4C4" }
  ],
  "tickers": [
    {
      "symbol": "VTI",
      "name": "Vanguard Total Stock Market ETF",
      "category": "US equities",
      "role": "One sentence on why this is included and what role it plays",
      "weight": "Core holding — 50% of portfolio"
    }
  ],
  "risk": {
    "level": "medium-high",
    "meter_pct": 72,
    "volatility": "Medium-high",
    "drawdown": "20 to 35%",
    "recovery": "2 to 4 years",
    "narrative": "2-3 sentences explaining the risk profile in plain English"
  },
  "scenarios": [
    {
      "name": "Recession",
      "impact": "moderate",
      "impact_label": "Moderate impact",
      "text": "2 sentences on how this portfolio behaves in a recession"
    },
    {
      "name": "Inflation spike",
      "impact": "low",
      "impact_label": "Low-moderate impact",
      "text": "2 sentences on inflation impact"
    },
    {
      "name": "Rate cuts",
      "impact": "positive",
      "impact_label": "Positive outlook",
      "text": "2 sentences on rate cut impact"
    },
    {
      "name": "Tech correction",
      "impact": "moderate",
      "impact_label": "Moderate impact",
      "text": "2 sentences on tech correction impact"
    }
  ],
  "tax_tips": [
    "One concrete tax tip relevant to this person",
    "Another tax tip",
    "A third tax tip"
  ],
  "rebalancing": {
    "cadence": "Every 6 months",
    "drift_threshold": "5%",
    "tips": [
      "One rebalancing tip",
      "Another rebalancing tip",
      "A third tip"
    ]
  },
  "monitoring": [
    "One thing to keep an eye on",
    "Another monitoring signal",
    "A third one"
  ],
  "narrative": "A warm, friendly 4-6 sentence overall summary wrapping up the blueprint in plain English. End with the legal disclaimer: This blueprint is for educational purposes only. Please speak to a licensed financial advisor before making any investment decisions."
}

RULES:
- All percentages in allocation must add up to exactly 100
- meter_pct is a number from 0 to 100 representing where on the risk spectrum this portfolio sits (0=most conservative, 100=most aggressive)
- Include 4 to 6 tickers that are genuinely appropriate for this person's profile. Use real ETF and fund tickers. Label everything as illustrative examples.
- Tailor everything specifically to the user's age, risk level, timeline and goal
- Do NOT give personalised tax advice. Keep tax tips general and educational.
- Do NOT use em dashes anywhere in any text values
- Return ONLY the JSON object, nothing else`;

  const userMessage = `Create an educational portfolio blueprint for:
Age: ${age}
Risk: ${risk}
Timeline: ${timeline || 'not specified'}
Goal: ${goal || 'not specified'}
Assets: ${assetTypes || 'stocks, ETFs and mutual funds'}
Notes: ${notes || 'none'}
Today: ${today}
Mode: ${isDeep ? 'deep analysis — include all sections with maximum detail' : 'standard — concise but complete'}`;

  const payload = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: isDeep ? 3000 : 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => { data += chunk; });
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            res.status(500).json({ error: parsed.error.message });
            return resolve();
          }
          const rawText = (parsed.content || [])
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('');

          // Strip any markdown code fences if present
          const cleaned = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

          let blueprint;
          try {
            blueprint = JSON.parse(cleaned);
          } catch (parseErr) {
            res.status(500).json({ error: 'Failed to parse blueprint JSON. Raw: ' + cleaned.substring(0, 200) });
            return resolve();
          }

          res.status(200).json({ blueprint });
          resolve();
        } catch (e) {
          res.status(500).json({ error: 'Response error: ' + e.message });
          resolve();
        }
      });
    });

    apiReq.on('error', (e) => {
      res.status(500).json({ error: 'Request failed: ' + e.message });
      resolve();
    });

    apiReq.write(payload);
    apiReq.end();
  });
};
