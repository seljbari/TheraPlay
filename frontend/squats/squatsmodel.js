// squatsmodel.js
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

function processAndDisplayPose(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  let isSquat = false;
  let statusText = "";

  // Key angles for squat detection
  const leftKneeAngle = getAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = getAngle(rightHip, rightKnee, rightAnkle);

  const leftHipAngle = getAngle(leftShoulder, leftHip, leftKnee);
  const rightHipAngle = getAngle(rightShoulder, rightHip, rightKnee);

  const leftBackAngle = getAngle(leftShoulder, leftHip, leftAnkle);
  const rightBackAngle = getAngle(rightShoulder, rightHip, rightAnkle);

  // Draw the angles
  drawAngleArc(leftHip, leftKnee, leftAnkle, leftKneeAngle, "cyan");
  drawAngleArc(rightHip, rightKnee, rightAnkle, rightKneeAngle, "cyan");

  drawAngleArc(leftShoulder, leftHip, leftKnee, leftHipAngle, "yellow");
  drawAngleArc(rightShoulder, rightHip, rightKnee, rightHipAngle, "yellow");


  const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
  const avgHipAngle = (leftHipAngle + rightHipAngle) / 2;
  
  // Check if person is in standing position (knees extended)
  const isStanding = avgKneeAngle > 160;
  
  // Check if person is in deep squat (knees bent significantly)
  const isDeepSquat = avgKneeAngle < 100 && avgHipAngle < 100;
  
  // Check if person is in partial squat
  const isPartialSquat = avgKneeAngle >= 100 && avgKneeAngle <= 140;

  if (isDeepSquat) {
    isSquat = true;
    statusText = `DEEP SQUAT! Knees:${avgKneeAngle.toFixed(0)}° Hips:${avgHipAngle.toFixed(0)}°`;
  } else if (isPartialSquat) {
    isSquat = true;
    statusText = `PARTIAL SQUAT - Knees:${avgKneeAngle.toFixed(0)}° Hips:${avgHipAngle.toFixed(0)}°`;
  } else if (isStanding) {
    statusText = `STANDING - Knees:${avgKneeAngle.toFixed(0)}° Hips:${avgHipAngle.toFixed(0)}°`;
  } else {
    statusText = `Position - Knees:${avgKneeAngle.toFixed(0)}° Hips:${avgHipAngle.toFixed(0)}°`;
  }

  setPoseText(statusText);
}

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