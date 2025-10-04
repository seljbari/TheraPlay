require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

app.post('/infer', async (req, res) => {
  const { exercise, angles } = req.body;

  const prompt = `
You are a physical therapy coach. The user performed the exercise: ${exercise}.
Here are their joint angles: ${JSON.stringify(angles)}.
Analyze their form and:
- Give a score out of 100 for technique.
- List 2-3 specific corrections.
- Briefly explain why each correction matters.
- If you see a safety issue, mention it.
Respond ONLY in valid JSON with keys: score, corrections, rationale, safety_flag.
`;

  try {
    const geminiRes = await axios.post(GEMINI_API_URL, {
      contents: [{ parts: [{ text: prompt }] }]
    });

    // Parse the model response following Google format
    let text = geminiRes.data.candidates[0].content.parts[0].text;
    console.log('Gemini raw response:', text);

    let jsonStart = text.indexOf('{');
    let jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('No JSON found in Gemini response');
    }
    const feedback = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
    res.json(feedback);
  } catch (err) {
    console.error('Error parsing Gemini response:', err.message);
    res.status(500).json({
      score: 0,
      corrections: ['Could not parse Gemini response.'],
      rationale: ['Check your input or try again.'],
      safety_flag: 'Error'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PT LLM API is running on http://localhost:${PORT}`);
});
