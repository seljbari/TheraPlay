// Squat-specific form analysis
class SquatAnalyzer {
  constructor() {
    this.repCount = 0;
    this.isDown = false;
    this.formIssues = [];
  }

  analyzePose(landmarks) {
    if (!landmarks) return null;

    // Get key points
    const leftHip = landmarks[23];
    const leftKnee = landmarks[25];
    const leftAnkle = landmarks[27];
    const rightHip = landmarks[24];
    const rightKnee = landmarks[26];
    const rightAnkle = landmarks[28];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    // Calculate angles
    const leftKneeAngle = CameraPoseDetector.calculateAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = CameraPoseDetector.calculateAngle(rightHip, rightKnee, rightAnkle);
    const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

    // Calculate back angle (should be relatively upright)
    const backAngle = CameraPoseDetector.calculateAngle(
      { x: leftShoulder.x, y: leftShoulder.y },
      leftHip,
      leftKnee
    );

    // Check squat depth
    const hipHeight = (leftHip.y + rightHip.y) / 2;
    const kneeHeight = (leftKnee.y + rightKnee.y) / 2;
    const isDeepEnough = hipHeight > kneeHeight; // Hip below knee

    // Detect rep (going down and coming up)
    if (avgKneeAngle < 100 && !this.isDown) {
      this.isDown = true;
    } else if (avgKneeAngle > 160 && this.isDown) {
      this.isDown = false;
      this.repCount++;
      updateRepCounter(this.repCount);
    }

    // Analyze form issues
    this.formIssues = [];
    
    if (avgKneeAngle < 90 && isDeepEnough) {
      this.formIssues.push({ type: 'good', message: 'Excellent depth! Hip below parallel.' });
    } else if (!isDeepEnough && avgKneeAngle < 100) {
      this.formIssues.push({ type: 'warning', message: 'Try to go deeper - hips should go below knees.' });
    }

    // Check knee alignment (knees shouldn't cave in)
    const kneeDistance = Math.abs(leftKnee.x - rightKnee.x);
    const ankleDistance = Math.abs(leftAnkle.x - rightAnkle.x);
    if (kneeDistance < ankleDistance * 0.8) {
      this.formIssues.push({ type: 'warning', message: 'Knees are caving in! Push them outward.' });
    }

    // Check back angle
    if (backAngle < 45) {
      this.formIssues.push({ type: 'warning', message: 'Your back is too horizontal. Keep chest up!' });
    } else if (backAngle > 45 && backAngle < 70) {
      this.formIssues.push({ type: 'good', message: 'Great back position! Nice and upright.' });
    }

    // Calculate form score (0-100)
    let formScore = 100;
    this.formIssues.forEach(issue => {
      if (issue.type === 'warning') formScore -= 15;
    });
    formScore = Math.max(0, formScore);

    return {
      kneeAngle: avgKneeAngle,
      backAngle: backAngle,
      isDeepEnough: isDeepEnough,
      formIssues: this.formIssues,
      formScore: formScore,
      repCount: this.repCount
    };
  }

  // Generate prompt for LLM
  generateLLMPrompt(analysis) {
    return `You are a fitness coach analyzing a squat exercise. Here's the form data:

Knee Angle: ${analysis.kneeAngle.toFixed(1)}° (ideal: 90-100° at bottom)
Back Angle: ${analysis.backAngle.toFixed(1)}° (ideal: 45-70°)
Depth: ${analysis.isDeepEnough ? 'Good - hip below knee' : 'Shallow - needs to go deeper'}

Current Issues Detected:
${analysis.formIssues.map(issue => `- ${issue.message}`).join('\n')}

Provide brief, encouraging feedback (max 25 words). Focus on ONE thing to improve if there are issues, or praise good form.`;
  }
}

// Helper function to update UI
function updateRepCounter(count) {
  document.getElementById('repCount').textContent = count;
}

function updateFormScore(score) {
  const scoreElement = document.getElementById('formScore');
  scoreElement.textContent = score;
  
  // Color code the score
  if (score >= 80) {
    scoreElement.style.color = '#10B981'; // green
  } else if (score >= 60) {
    scoreElement.style.color = '#F59E0B'; // yellow
  } else {
    scoreElement.style.color = '#EF4444'; // red
  }
}