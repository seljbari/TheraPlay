// sideplankmodel.js
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let poseLandmarkerVideo = null;
let poseLandmarkerImage = null;
let webcamRunning = false;

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const enableWebcamButton = document.getElementById("webcamButton");

let poseCheckerEl = null;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    poseCheckerEl = document.getElementById("poseChecker");
  });
} else {
  poseCheckerEl = document.getElementById("poseChecker");
}

function setPoseText(text) {
  if (poseCheckerEl) poseCheckerEl.innerText = text;
}

function getAngle(a, b, c) {
  if (!a || !b || !c) return 0;
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const cb = { x: b.x - c.x, y: b.y - c.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.hypot(ab.x, ab.y);
  const magCB = Math.hypot(cb.x, cb.y);
  if (magAB === 0 || magCB === 0) return 0;
  const cos = Math.min(1, Math.max(-1, dot / (magAB * magCB)));
  return Math.acos(cos) * (180 / Math.PI);
}

function drawAngleArc(a, b, c, angle, color = "cyan") {
  const cw = canvasElement.width;
  const ch = canvasElement.height;

  const bx = b.x * cw;
  const by = b.y * ch;

  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };

  const startAngle = Math.atan2(v1.y, v1.x);
  const endAngle = Math.atan2(v2.y, v2.x);

  const radius = Math.min(40, Math.min(cw, ch) * 0.08);

  canvasCtx.beginPath();
  canvasCtx.arc(bx, by, radius, startAngle, endAngle, false);
  canvasCtx.strokeStyle = color;
  canvasCtx.lineWidth = 3;
  canvasCtx.stroke();

  canvasCtx.font = "bold 18px Arial";
  canvasCtx.fillStyle = color;
  canvasCtx.strokeStyle = "black";
  canvasCtx.lineWidth = 4;
  const textX = bx + radius * Math.cos((startAngle + endAngle) / 2);
  const textY = by + radius * Math.sin((startAngle + endAngle) / 2);
  canvasCtx.strokeText(`${angle.toFixed(0)}°`, textX, textY);
  canvasCtx.fillText(`${angle.toFixed(0)}°`, textX, textY);
}

const drawingUtils = new DrawingUtils(canvasCtx);
let lastVideoTime = -1;

const createPoseLandmarkers = async () => {
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );

    poseLandmarkerVideo = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numPoses: 1
    });

    poseLandmarkerImage = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU"
      },
      runningMode: "IMAGE",
      numPoses: 1
    });
  } catch (error) {
    console.error("Failed to load PoseLandmarker(s):", error);
  }
};
createPoseLandmarkers();

const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;
if (hasGetUserMedia()) {
  enableWebcamButton.addEventListener("click", enableCam);
}

function stopWebcamTracks() {
  if (video.srcObject) {
    const tracks = video.srcObject.getTracks();
    tracks.forEach(t => t.stop());
    video.srcObject = null;
  }
  webcamRunning = false;
  enableWebcamButton.innerText = "ENABLE PREDICTIONS";
}

function enableCam() {
  if (!poseLandmarkerVideo) {
    console.warn("Video landmarker not ready yet.");
    return;
  }

  webcamRunning = !webcamRunning;
  enableWebcamButton.innerText = webcamRunning
    ? "DISABLE PREDICTIONS"
    : "ENABLE PREDICTIONS";

  if (webcamRunning) {
    navigator.mediaDevices.getUserMedia({
      video: {
        width: 640,
        height: 360
      }
    })
    .then((stream) => {
      video.srcObject = stream;
      video.play();
      video.addEventListener("loadeddata", () => {
        canvasElement.width = video.videoWidth || 640;
        canvasElement.height = video.videoHeight || 360;
        window.requestAnimationFrame(predictWebcam);
      }, { once: true });
    })
    .catch((err) => console.error("getUserMedia error:", err));
  } else {
    stopWebcamTracks();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    setPoseText("");
  }
}

async function predictWebcam() {
  if (!webcamRunning) return;

  if (video.readyState < 2) {
    if (webcamRunning) window.requestAnimationFrame(predictWebcam);
    return;
  }

  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    const startTimeMs = performance.now();

    try {
      const result = await poseLandmarkerVideo.detectForVideo(video, startTimeMs);

      canvasCtx.save();
      canvasElement.width = video.videoWidth || canvasElement.width;
      canvasElement.height = video.videoHeight || canvasElement.height;
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      if (result && result.landmarks && result.landmarks.length > 0) {
        const landmarks = result.landmarks[0];

        for (const landmark of landmarks) {
          drawingUtils.drawLandmarks([landmark], {
            color: '#FF0000',
            fillColor: '#FF0000',
            radius: 6
          });
        }

        if (PoseLandmarker.POSE_CONNECTIONS) {
          drawingUtils.drawConnectors(
            landmarks,
            PoseLandmarker.POSE_CONNECTIONS,
            { color: '#00FF00', lineWidth: 4 }
          );
        }

        processAndDisplayPose(landmarks);
      } else {
        setPoseText("No person detected");
      }

      canvasCtx.restore();
    } catch (err) {
      console.error("Error during detection:", err);
    }
  }

  if (webcamRunning) {
    window.requestAnimationFrame(predictWebcam);
  }
}


// State variables
let info = null;
let lastPlankImageBase64 = null;
let isAnalyzing = false;
let isHoldingPlank = false;
let holdStartTime = null;
let totalHoldTime = 0;
let lastPlankSide = null;

function updateHoldTimeDisplay(holdTime) {
  const holdTimeDisplayEl = document.getElementById("holdTimeDisplay");
  const holdTimeStatEl = document.getElementById("holdTime");
  
  const formattedTime = `${holdTime.toFixed(1)}s`;
  
  if (holdTimeDisplayEl) {
    holdTimeDisplayEl.textContent = formattedTime;
  }
  
  if (holdTimeStatEl) {
    holdTimeStatEl.textContent = formattedTime;
  }

  // Update report button status
  const reportBtn = document.getElementById("detailedReportBtn");
  if (reportBtn) {
    if (isAnalyzing) {
      reportBtn.textContent = "⏳ Analyzing...";
      reportBtn.disabled = true;
    } else if (info && info.debug) {
      reportBtn.textContent = "✓ View AI Report";
      reportBtn.disabled = false;
    } else {
      reportBtn.textContent = "Detailed Report";
      reportBtn.disabled = false;
    }
  }
}

function processAndDisplayPose(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  // Calculate angles
  const leftElbowAngle = getAngle(leftShoulder, leftElbow, leftWrist);
  const rightElbowAngle = getAngle(rightShoulder, rightElbow, rightWrist);
  
  const leftBodyAngle = getAngle(leftShoulder, leftHip, leftAnkle);
  const rightBodyAngle = getAngle(rightShoulder, rightHip, rightAnkle);
  
  const leftHipAngle = getAngle(leftShoulder, leftHip, leftKnee);
  const rightHipAngle = getAngle(rightShoulder, rightHip, rightKnee);
  
  const leftKneeAngle = getAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = getAngle(rightHip, rightKnee, rightAnkle);

  // Draw angle arcs
  drawAngleArc(leftShoulder, leftElbow, leftWrist, leftElbowAngle, "cyan");
  drawAngleArc(rightShoulder, rightElbow, rightWrist, rightElbowAngle, "cyan");
  drawAngleArc(leftShoulder, leftHip, leftAnkle, leftBodyAngle, "yellow");
  drawAngleArc(rightShoulder, rightHip, rightAnkle, rightBodyAngle, "yellow");
  drawAngleArc(leftShoulder, leftHip, leftKnee, leftHipAngle, "magenta");
  drawAngleArc(rightShoulder, rightHip, rightKnee, rightHipAngle, "magenta");
  drawAngleArc(leftHip, leftKnee, leftAnkle, leftKneeAngle, "orange");
  drawAngleArc(rightHip, rightKnee, rightAnkle, rightKneeAngle, "orange");

  // Determine which side is down (supporting arm)
  const leftArmLower = leftElbow.y > rightElbow.y;
  const rightArmLower = rightElbow.y > leftElbow.y;

  let supportElbowAngle, supportBodyAngle, supportSide;
  
  if (leftArmLower) {
    supportElbowAngle = leftElbowAngle;
    supportBodyAngle = leftBodyAngle;
    supportSide = "LEFT";
  } else {
    supportElbowAngle = rightElbowAngle;
    supportBodyAngle = rightBodyAngle;
    supportSide = "RIGHT";
  }

  // Check if body is aligned (straight line from shoulder to ankle)
  const bodyAligned = supportBodyAngle > 155 && supportBodyAngle < 205;
  
  // Check if supporting arm is extended (forearm plank ~90°) or straight arm (~160-180°)
  const forearmPlank = supportElbowAngle > 70 && supportElbowAngle < 110;
  const straightArmPlank = supportElbowAngle > 150;
  
  // Check if knees are straight
  const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
  const kneesStright = avgKneeAngle > 160;

  const isSidePlank = bodyAligned && (forearmPlank || straightArmPlank) && kneesStright;
  
  let statusText = "";
  
  if (isSidePlank) {
    const plankType = forearmPlank ? "FOREARM" : "STRAIGHT ARM";
    
    // Start timer if not already holding
    if (!isHoldingPlank) {
      isHoldingPlank = true;
      holdStartTime = Date.now();
      lastPlankSide = supportSide;
      console.log(`✅ Side plank detected: ${supportSide} ${plankType}`);
    }
    
    // Update hold time
    const currentHoldDuration = (Date.now() - holdStartTime) / 1000;
    totalHoldTime = currentHoldDuration;
    
    statusText = `✓ SIDE PLANK (${supportSide}) - ${plankType} | Hold: ${totalHoldTime.toFixed(1)}s`;
    
    // Update display
    updateHoldTimeDisplay(totalHoldTime);
    
    // Capture image during the hold (but don't send to API yet)
    capturePlankImage(landmarks, totalHoldTime, supportSide);
    
  } else {
    // Lost form
    if (isHoldingPlank) {
      console.log(`Side plank ended. Total hold: ${totalHoldTime.toFixed(1)}s`);
      isHoldingPlank = false;
      holdStartTime = null;
    }
    
    if (bodyAligned) {
      statusText = `Body aligned but adjust arm position | Body:${supportBodyAngle.toFixed(0)}° Elbow:${supportElbowAngle.toFixed(0)}°`;
    } else if (forearmPlank || straightArmPlank) {
      statusText = `Arm good, straighten body | Body:${supportBodyAngle.toFixed(0)}° Elbow:${supportElbowAngle.toFixed(0)}°`;
    } else {
      statusText = `Not in side plank position | Body:${supportBodyAngle.toFixed(0)}° Elbow:${supportElbowAngle.toFixed(0)}°`;
    }
  }

  setPoseText(statusText);
}

// Just capture the image, don't send to API yet
function capturePlankImage(landmarks, holdDuration, side) {
  const captureCanvas = document.createElement("canvas");
  captureCanvas.width = video.videoWidth;
  captureCanvas.height = video.videoHeight;
  const captureCtx = captureCanvas.getContext("2d");

  captureCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
  lastPlankImageBase64 = captureCanvas.toDataURL("image/jpeg", 0.9);
  
  // Store the landmarks and metadata for later analysis
  window.lastPlankData = {
    landmarks: landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z })),
    holdDuration: holdDuration,
    side: side
  };
}

// Only send to API when user clicks "Detailed Report"
function sendPlankDataToAPI() {
  if (!lastPlankImageBase64 || !window.lastPlankData) {
    console.error("No plank data captured");
    return Promise.reject("No data to analyze");
  }

  isAnalyzing = true;
  updateHoldTimeDisplay(totalHoldTime);

  // Convert base64 back to blob
  return fetch(lastPlankImageBase64)
    .then(res => res.blob())
    .then(blob => {
      const formData = new FormData();
      formData.append("repImage", blob, `sideplank_${window.lastPlankData.holdDuration.toFixed(1)}s.jpg`);
      formData.append("keypoints", JSON.stringify(window.lastPlankData.landmarks));
      formData.append("exercise", "sideplank");
      formData.append("holdDuration", window.lastPlankData.holdDuration.toFixed(1));
      formData.append("side", window.lastPlankData.side);
      formData.append("repCount", 1);

      console.log('📤 Sending to server for analysis...');

      return fetch('/api/infer', { 
        method: 'POST',
        body: formData 
      });
    })
    .then(res => {
      if (!res.ok) {
        throw new Error(`Server responded with status: ${res.status}`);
      }
      return res.json();
    })
    .then(result => {
      console.log('✅ Inference result received:', result);
      
      info = {
        ...result,
        image_data: lastPlankImageBase64 
      };
      
      isAnalyzing = false;
      updateHoldTimeDisplay(totalHoldTime);
      
      return info;
    })
    .catch(err => {
      console.error('❌ Error posting data to infer:', err);
      isAnalyzing = false;
      updateHoldTimeDisplay(totalHoldTime);
      throw err;
    });
}

function renderLLMDebug(rawText, container) {
  if (!rawText) return;

  const text = String(rawText).trim();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const sectionNodes = [];
  let current = { title: null, items: [], paragraphs: [] };

  function pushCurrent() {
    if (current.title || current.paragraphs.length || current.items.length) {
      sectionNodes.push(current);
      current = { title: null, items: [], paragraphs: [] };
    }
  }

  for (let ln of lines) {
    if (/^(General Observations|Recommendations|To provide more precise|AI Analysis|Debug Information|General Observations & Potential Issues|Recommendations:)/i.test(ln)) {
      pushCurrent();
      current.title = ln.replace(/:$/,'');
      continue;
    }

    if (/^\d+\.\s+/.test(ln)) {
      current.items.push(ln.replace(/^\d+\.\s+/, ''));
      continue;
    }

    if (/^[\*\-\u2022]\s+/.test(ln)) {
      current.items.push(ln.replace(/^[\*\-\u2022]\s+/, ''));
      continue;
    }

    current.paragraphs.push(ln);
  }
  pushCurrent();

  container.innerHTML = '';
  sectionNodes.forEach((sec, idx) => {
    const section = document.createElement('section');
    section.className = 'debug-block';

    const titleText = sec.title || (idx === 0 ? 'Summary' : `Section ${idx+1}`);
    const h = document.createElement('h4');
    h.textContent = titleText;
    section.appendChild(h);

    const shouldCollapse = (sec.paragraphs.join(' ') + sec.items.join(' ')).length > 600;
    const wrapper = shouldCollapse ? document.createElement('details') : document.createElement('div');
    if (shouldCollapse) {
      wrapper.className = 'debug-collapsible';
      wrapper.open = false;
      const summary = document.createElement('summary');
      summary.textContent = 'Expand details';
      wrapper.appendChild(summary);
    }

    sec.paragraphs.forEach(p => {
      const pEl = document.createElement('p');
      pEl.innerHTML = highlightInline(p);
      wrapper.appendChild(pEl);
    });

    if (sec.items.length) {
      const ul = document.createElement('ul');
      ul.className = 'debug-list';
      sec.items.forEach(it => {
        const li = document.createElement('li');
        li.innerHTML = highlightInline(it);
        ul.appendChild(li);
      });
      wrapper.appendChild(ul);
    }

    if (/Debug Information|Debug Analysis/i.test(titleText)) {
      const rawBtn = document.createElement('button');
      rawBtn.type = 'button';
      rawBtn.className = 'btn-raw';
      rawBtn.textContent = 'View Raw Log';
      rawBtn.addEventListener('click', () => {
        const pre = document.createElement('pre');
        pre.className = 'raw-dump';
        pre.textContent = text;
        pre.style.whiteSpace = 'pre-wrap';
        if (!section.querySelector('.raw-dump')) section.appendChild(pre);
        rawBtn.disabled = true;
      });
      section.appendChild(rawBtn);
    }

    section.appendChild(wrapper);
    container.appendChild(section);
  });

  function highlightInline(str) {
    str = str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    str = str.replace(/__(.+?)__/g, '<strong>$1</strong>');
    str = str.replace(/\*(.+?)\*/g, '<em>$1</em>');
    str = str.replace(/\[(\d+(?:,\s*\d+)*)\]/g, '<span class="kp">[$1]</span>');
    str = str.replace(/(\d{1,3}\s?°|degree[s]?|degrees)/gi, '<span class="meta">$1</span>');
    return str;
  }
}

function createReport() {
  const targetInput = document.getElementById("targetTime");
  const overlay = document.getElementById("overlay");
  const content = document.getElementById("reportContent");
  
  if (!overlay || !content) {
    console.error("Overlay elements not found in DOM");
    return;
  }
  
  const targetTime = parseInt(targetInput?.value || 30, 10);

  // Check if we have captured any plank data
  if (!lastPlankImageBase64 || !window.lastPlankData) {
    content.innerHTML = `
      <div class="report-section">
        <p style="font-size: 18px; color: var(--danger);">
          No plank session data available yet!
        </p>
        <p style="color: var(--muted);">
          Hold a side plank to capture data, then click this button for analysis.
        </p>
      </div>
    `;
    overlay.style.display = "flex";
    return;
  }

  // Check if user held long enough
  if (totalHoldTime < targetTime) {
    content.innerHTML = `
      <div class="report-section">
        <p style="font-size: 18px; color: var(--danger);">
          You held for ${totalHoldTime.toFixed(1)}s but the target is ${targetTime}s!
        </p>
        <p style="color: var(--muted);">
          Keep going to reach your target time.
        </p>
      </div>
    `;
    overlay.style.display = "flex";
    return;
  }

  // Show "analyzing" message first
  content.innerHTML = `
    <div class="report-section">
      <p style="font-size: 18px; color: var(--primary);">
        ⏳ AI is analyzing your form...
      </p>
      <p style="color: var(--muted);">
        Please wait a moment.
      </p>
    </div>
  `;
  overlay.style.display = "flex";

  // Send to API NOW (only when button is clicked)
  sendPlankDataToAPI()
    .then(() => {
      // Clear and rebuild with results
      content.innerHTML = '';

      // Add image
      if (info && info.image_data) {
        const imageContainer = document.createElement("div");
        imageContainer.className = "report-image-container";
        
        const img = document.createElement("img");
        img.src = info.image_data;
        img.alt = "Screenshot of your side plank hold";
        
        imageContainer.appendChild(img);
        content.appendChild(imageContainer);
      }

      // Add AI feedback
      if (info && info.debug) {
        const debugSection = document.createElement('div');
        debugSection.className = 'report-section';
        debugSection.innerHTML = `<h3>AI Feedback</h3><div class="debug-container"></div>`;
        content.appendChild(debugSection);

        const container = debugSection.querySelector('.debug-container');
        renderLLMDebug(info.debug, container);
      } else if (info) {
        const basicSection = document.createElement('div');
        basicSection.className = 'report-section';
        basicSection.innerHTML = `
          <h3>Analysis Results</h3>
          <p><strong>Score:</strong> ${info.score || 'N/A'}/100</p>
          <p><strong>Corrections:</strong> ${(info.corrections || []).join(', ') || 'None'}</p>
          <p><strong>Rationale:</strong> ${(info.rationale || []).join(' ') || 'N/A'}</p>
        `;
        content.appendChild(basicSection);
      }
    })
    .catch(err => {
      content.innerHTML = `
        <div class="report-section">
          <p style="color: var(--danger);">Failed to analyze: ${err.message || err}</p>
          <p style="color: var(--muted);">Please try again.</p>
        </div>
      `;
    });
}

function closeOverlay() {
  const overlay = document.getElementById("overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
}

// Event listeners
const report = document.getElementById("detailedReportBtn");
if (report) {
  report.addEventListener("click", createReport);
}

const close = document.getElementById('closeOverlay');
if (close) {
  close.addEventListener('click', closeOverlay);
}

const overlayEl = document.getElementById('overlay');
if (overlayEl) {
  overlayEl.addEventListener('click', function(e) {
    if (e.target === this) {
      closeOverlay();
    }
  });
}

// Reset button
const resetBtn = document.getElementById("resetSessionBtn");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    totalHoldTime = 0;
    isHoldingPlank = false;
    holdStartTime = null;
    lastPlankSide = null;
    info = null;
    lastPlankImageBase64 = null;
    window.lastPlankData = null;
    updateHoldTimeDisplay(0);
    console.log("Session reset");
  });
}

// Demo image detection
const imageEl = document.querySelector(".detectOnClick img");
if (imageEl) {
  imageEl.style.cursor = "pointer";
  imageEl.addEventListener("click", async () => {
    if (!poseLandmarkerImage) {
      console.warn("Image landmarker not ready yet.");
      return;
    }

    if (webcamRunning) {
      stopWebcamTracks();
    }

    const imgW = imageEl.clientWidth || imageEl.naturalWidth;
    const imgH = imageEl.clientHeight || imageEl.naturalHeight;
    canvasElement.width = imgW;
    canvasElement.height = imgH;

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    try {
      const result = await poseLandmarkerImage.detect(imageEl);

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      if (result && result.landmarks && result.landmarks.length > 0) {
        const landmarks = result.landmarks[0];

        for (const landmark of landmarks) {
          drawingUtils.drawLandmarks([landmark], {
            color: '#FF0000',
            fillColor: '#FF0000',
            radius: 6
          });
        }

        if (PoseLandmarker.POSE_CONNECTIONS) {
          drawingUtils.drawConnectors(
            landmarks,
            PoseLandmarker.POSE_CONNECTIONS,
            { color: '#00FF00', lineWidth: 4 }
          );
        }

        processAndDisplayPose(landmarks);
      } else {
        setPoseText("No person detected in image");
      }

      canvasCtx.restore();
    } catch (err) {
      console.error("Error during image detection:", err);
    }
  });
}