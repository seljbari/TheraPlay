// backend/routes/routes.js - WITH RATE LIMITING
const express = require('express');
const router = express.Router();
const multer = require('multer');
require('dotenv').config();

const upload = multer({ storage: multer.memoryStorage() });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 👇 RATE LIMITING: Track API calls per minute
const rateLimitMap = new Map(); // Stores { timestamp: count }
const MAX_CALLS_PER_MINUTE = 2;
const TIME_WINDOW = 60000; // 1 minute in milliseconds

function checkRateLimit() {
  const now = Date.now();
  const oneMinuteAgo = now - TIME_WINDOW;
  
  // Clean up old entries
  for (const [timestamp] of rateLimitMap) {
    if (timestamp < oneMinuteAgo) {
      rateLimitMap.delete(timestamp);
    }
  }
  
  // Count calls in the last minute
  let callCount = 0;
  for (const count of rateLimitMap.values()) {
    callCount += count;
  }
  
  // Check if limit exceeded
  if (callCount >= MAX_CALLS_PER_MINUTE) {
    return false; // Rate limit exceeded
  }
  
  // Add this call to the tracker
  rateLimitMap.set(now, 1);
  return true; // OK to proceed
}

router.post('/infer', upload.single('repImage'), async (req, res) => { 
  try {
    // 👇 CHECK RATE LIMIT FIRST
    if (!checkRateLimit()) {
      console.log('⏱️ Rate limit exceeded');
      return res.status(429).json({
        score: 0,
        corrections: ['Too many requests'],
        rationale: ['Rate limit: Maximum 5 API calls per minute. Please wait and try again.'],
        safety_flag: 'RateLimited'
      });
    }

    const repImage = req.file;
    const { exercise, keypoints, repCount } = req.body || {}; 
    
    if (!repImage || !exercise || !keypoints) {
      console.log('❌ Validation failed - missing required fields');
      return res.json({
        score: 0,
        corrections: ['Missing image, exercise, or keypoints'],
        rationale: ['Please provide all required form data'],
        safety_flag: 'BadRequest'
      });
    }

    let parsedKeypoints;
    try {
      parsedKeypoints = JSON.parse(keypoints);
      
      if (!Array.isArray(parsedKeypoints) || parsedKeypoints.length === 0) {
        throw new Error('Keypoints array is empty');
      }
    } catch (e) {
      console.error('Failed to parse keypoints:', e.message);
      return res.json({
        score: 0,
        corrections: ['Invalid keypoints data'],
        rationale: ['Keypoints must be a valid JSON array'],
        safety_flag: 'BadRequest'
      });
    }

    console.log(`Received image: ${repImage.originalname}, size: ${repImage.size} bytes`);
    console.log(`Received exercise: ${exercise}, Rep: ${repCount}`);
    
    const prompt = `You are a physical therapy coach analyzing form.
    Exercise: ${exercise}
    Keypoints measured for the completed rep: ${JSON.stringify(parsedKeypoints, null, 2)}
    ... (rest of your existing prompt structure) ...`;

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

    let cleanText = text.trim();
    cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

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