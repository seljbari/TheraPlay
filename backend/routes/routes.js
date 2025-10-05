// backend/routes/routes.js - SIMPLE VERSION THAT WORKS
const express = require('express');
const router = express.Router();
const multer = require('multer'); // 👈 ADD THIS
require('dotenv').config();

const upload = multer({ storage: multer.memoryStorage() }); // 👈 ADD THIS

const GEMINI_API_KEY =  process.env.GEMINI_API_KEY;

router.post('/infer', upload.single('repImage'), async (req, res) => { 
  try {

    const repImage = req.file; // The image file is here
    const { exercise, keypoints, repCount } = req.body || {}; 
    

      // ⚠️ CHANGE: Check for image, exercise, and keypoints
  // Better validation that checks for actual missing data
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
      
      // Check if it's actually an array with data
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
    
    // In a real application, you would calculate angles from parsedKeypoints here
    // For now, we will use the keypoints array directly in the prompt
    
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