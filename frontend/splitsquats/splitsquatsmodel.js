// splitsquatsmodel.js
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

function getDistance(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function drawAngleArc(a, b, c, angle) {
  // use current canvas size (works for video or image)
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
  canvasCtx.strokeStyle = "cyan";
  canvasCtx.lineWidth = 3;
  canvasCtx.stroke();

  canvasCtx.font = "bold 18px Arial";
  canvasCtx.fillStyle = "cyan";
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
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];

  let isSplitSquat = false;
  let statusText = "";

  const leftKneeAngle = getAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = getAngle(rightHip, rightKnee, rightAnkle);

  drawAngleArc(leftHip, leftKnee, leftAnkle, leftKneeAngle);
  drawAngleArc(rightHip, rightKnee, rightAnkle, rightKneeAngle);

  const hipWidth = Math.abs(leftHip.x - rightHip.x);
  const kneeWidth = Math.abs(leftKnee.x - rightKnee.x);
  const ankleWidth = Math.abs(leftAnkle.x - rightAnkle.x);

  const isStaggered = (kneeWidth > hipWidth * 1.3) || (ankleWidth > hipWidth * 1.3);
  const hasDeepBend = leftKneeAngle < 110 || rightKneeAngle < 110;
  const hasOneDeepKnee = Math.abs(leftKneeAngle - rightKneeAngle) > 20;

  if (isStaggered && hasDeepBend) {
    isSplitSquat = true;
    statusText = `SPLIT SQUAT! L:${leftKneeAngle.toFixed(0)}° R:${rightKneeAngle.toFixed(0)}°`;
  } else if (hasDeepBend && hasOneDeepKnee) {
    isSplitSquat = true;
    statusText = `SPLIT SQUAT (lunge)! L:${leftKneeAngle.toFixed(0)}° R:${rightKneeAngle.toFixed(0)}°`;
  } else if (hasDeepBend) {
    statusText = `Squat detected L:${leftKneeAngle.toFixed(0)}° R:${rightKneeAngle.toFixed(0)}°`;
  } else {
    statusText = `Standing L:${leftKneeAngle.toFixed(0)}° R:${rightKneeAngle.toFixed(0)}°`;
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
