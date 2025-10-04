// Main application logic
let cameraPose = null;
let pushupAnalyzer = null;
let lastFeedbackTime = 0;
const FEEDBACK_INTERVAL = 3000; // Get LLM feedback every 3 seconds

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  const webcamButton = document.getElementById('webcamButton');
  const videoElement = document.getElementById('webcam');
  const canvasElement = document.getElementById('output_canvas');

  // Initialize push analyzer
  pushupAnalyzer = new PushupAnalyzer();

  // Initialize camera and pose detector
  cameraPose = new CameraPoseDetector(videoElement, canvasElement, onPoseDetected);

  // Setup webcam button
  webcamButton.addEventListener('click', async () => {
    webcamButton.disabled = true;
    webcamButton.textContent = 'Loading...';
    
    try {
      await cameraPose.start();
      webcamButton.style.display = 'none';
      updateStatus('active', 'Camera active - Start exercising!');
    } catch (error) {
      console.error('Error starting camera:', error);
      webcamButton.disabled = false;
      webcamButton.textContent = 'ENABLE WEBCAM';
      alert('Could not access camera. Please ensure camera permissions are granted.');
    }
  });
});

// Called every frame when pose is detected
function onPoseDetected(landmarks) {
  // Analyze the pose
  const analysis = pushupAnalyzer.analyzePose(landmarks);
  
  if (!analysis) return;

  // Update UI with form score
  updateFormScore(analysis.formScore);

  // Show immediate feedback for critical issues
  showImmediateFeedback(analysis.formIssues);

  // Get LLM feedback periodically (not every frame - too expensive!)
  const now = Date.now();
  if (now - lastFeedbackTime > FEEDBACK_INTERVAL) {
    lastFeedbackTime = now;
    getLLMFeedback(analysis);
  }
}

// Show immediate feedback without LLM
function showImmediateFeedback(issues) {
  if (issues.length === 0) return;

  const feedbackContent = document.getElementById('feedbackContent');
  const latestIssue = issues[issues.length - 1];

  // Create feedback HTML
  const feedbackHTML = `
    <div class="feedback-item feedback-${latestIssue.type}">
      <span class="feedback-icon">${latestIssue.type === 'good' ? '✅' : '⚠️'}</span>
      <p>${latestIssue.message}</p>
    </div>
  `;

  feedbackContent.innerHTML = feedbackHTML;
}

// Get AI feedback from LLM
async function getLLMFeedback(analysis) {
  const prompt = pushupAnalyzer.generateLLMPrompt(analysis);

  try {
    updateStatus('thinking', 'AI analyzing your form...');

    // TODO: Replace with your actual LLM API call
    // For now, using mock response
    const feedback = await callLLM(prompt);

    // Display LLM feedback
    displayLLMFeedback(feedback, analysis.formScore);
    
    updateStatus('active', 'Receiving AI feedback');
  } catch (error) {
    console.error('Error getting LLM feedback:', error);
    updateStatus('active', 'Camera active');
  }
}

// Call your LLM API (Claude, OpenAI, etc.)
async function callLLM(prompt) {
  // REPLACE THIS WITH YOUR ACTUAL API CALL
  // Example for Claude API:
  /*
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'YOUR_API_KEY',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });
  const data = await response.json();
  return data.content[0].text;
  */

  // Mock response for now
  return new Promise(resolve => {
    setTimeout(() => {
      resolve("Great form! Keep your chest up and maintain that depth. You're crushing it! 💪");
    }, 500);
  });
}

// Display LLM feedback in UI
function displayLLMFeedback(feedback, score) {
  const feedbackContent = document.getElementById('feedbackContent');
  
  const feedbackHTML = `
    <div class="feedback-item feedback-llm">
      <div class="feedback-header-small">
        <span class="feedback-icon">🤖</span>
        <span class="ai-badge">AI Coach</span>
      </div>
      <p class="llm-feedback">${feedback}</p>
      <div class="feedback-score">Form Score: ${score}/100</div>
    </div>
  `;

  feedbackContent.innerHTML = feedbackHTML;
}

// Update status indicator
function updateStatus(status, message) {
  const indicator = document.getElementById('statusIndicator');
  indicator.className = `status-indicator status-${status}`;
  indicator.querySelector('span:last-child').textContent = message;
}