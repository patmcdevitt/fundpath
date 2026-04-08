const https = require('https');

module.exports = async function handler(req, res) {

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured.' });
  }

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });

  const isDeep = mode === 'deep';

  const systemPrompt = `You are FundPath, a warm and helpful educational portfolio assistant. Speak like a knowledgeable friend, not a textbook.

RULES:
1. Start with: "This is an educational portfolio blueprint for informational purposes only and is not investment advice."
2. Never use definitive buy/sell/hold language.
3. Label all holdings as illustrative examples only.
4. Include risk warnings.
5. End with: "This blueprint is for educational purposes only. Please speak to a licensed financial advisor before making any investment decisions."
6. Write in plain friendly English.
7. Do not use em dashes.

SECTIONS TO INCLUDE:
${isDeep ? `## 1. Your Profile
## 2. Current Market Context
## 3. Recommended Portfolio Mix
## 4. Why Each Asset Is Included
## 5. Factor Exposure Analysis
## 6. Risk Profile
## 7. Time Horizon Considerations
## 8. Scenario Analysis (recession, inflation, rate cuts, tech crash, energy shock)
## 9. Tax Considerations
## 10. Rebalancing Framework
## 11. Suitability Warnings
## 12. What to Monitor` : `## 1. Your Profile
## 2. Recommended Portfolio Mix
## 3. Why Each Asset Is Included
## 4. Key Risks
## 5. Getting Started
## 6. Important Warnings`}`;

  const userMessage = `Write an educational portfolio blueprint for:
Age: ${age}
Risk tolerance: ${risk}
Timeline: ${timeline || 'not specified'}
Goal: ${goal || 'not specified'}
Assets: ${assetTypes || 'stocks, ETFs and mutual funds'}
Notes: ${notes || 'none'}
Today: ${today}`;

  const payload = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: isDeep ? 3000 : 1500,
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
          const text = (parsed.content || [])
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('');
          if (!text) {
            res.status(500).json({ error: 'No response generated. Please try again.' });
            return resolve();
          }
          res.status(200).json({ result: text });
          resolve();
        } catch (e) {
          res.status(500).json({ error: 'Failed to parse response: ' + e.message });
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
