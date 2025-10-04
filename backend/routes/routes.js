// backend/routes/routes.js - SIMPLE VERSION THAT WORKS
const express = require('express');
const router = express.Router();

const GEMINI_API_KEY = 'env';

router.post('/infer', async (req, res) => {
  try {
    const { exercise, angles } = req.body || {};
    
    if (!exercise || !angles) {
      return res.json({
        score: 0,
        corrections: ['Missing exercise or angles'],
        rationale: ['Please provide both exercise name and angles'],
        safety_flag: 'BadRequest'
      });
    }

    const prompt = `You are a physical therapy coach analyzing form.
Exercise: ${exercise}
Angles measured: ${JSON.stringify(angles)}

Respond with ONLY a JSON object (no markdown, no extra text) with these fields:
- score: number from 0-100
- corrections: array of specific form corrections needed
- rationale: array of explanations for the corrections
- safety_flag: "Good", "Warning", or "Danger"

Example: {"score":85,"corrections":["Bend knee more"],"rationale":["Better muscle engagement"],"safety_flag":"Good"}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      return res.json({
        score: 0,
        corrections: ['API request failed'],
        rationale: [errorText],
        safety_flag: 'Error'
      });
    }

    const data = await response.json();
    console.log('Full API response:', JSON.stringify(data, null, 2));

    // Extract the text from Gemini's response
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      return res.json({
        score: 0,
        corrections: ['No response from AI'],
        rationale: ['Model returned empty response'],
        safety_flag: 'Error'
      });
    }

    console.log('Model output:', text);

    // Clean up the text (remove markdown if present)
    let cleanText = text.trim();
    cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Find JSON object in the text
    const jsonStart = cleanText.indexOf('{');
    const jsonEnd = cleanText.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      return res.json({
        score: 0,
        corrections: ['Could not parse AI response'],
        rationale: ['Model did not return valid JSON'],
        safety_flag: 'Error',
        debug: text
      });
    }

    const jsonStr = cleanText.substring(jsonStart, jsonEnd + 1);
    const result = JSON.parse(jsonStr);

    // Make sure all required fields exist
    const finalResult = {
      score: result.score || 0,
      corrections: result.corrections || ['No corrections provided'],
      rationale: result.rationale || ['No rationale provided'],
      safety_flag: result.safety_flag || 'Unknown'
    };

    return res.json(finalResult);

  } catch (error) {
    console.error('Error in /api/infer:', error);
    return res.json({
      score: 0,
      corrections: ['Server error occurred'],
      rationale: [error.message],
      safety_flag: 'Error'
    });
  }
});

module.exports = router;