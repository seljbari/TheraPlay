// splitsquatsmodel.js
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let poseLandmarker = null;
let webcamRunning = false;

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const enableWebcamButton = document.getElementById("webcamButton");

// numeric sizes for drawing
const VIDEO_HEIGHT = 360;
const VIDEO_WIDTH = 640;

// set canvas element pixel dimensions to match displayed size
canvasElement.width = VIDEO_WIDTH;
canvasElement.height = VIDEO_HEIGHT;

// helper functions
function getAngle(a, b, c) {
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
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// create the model
const createPoseLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numPoses: 1
  });

  console.log("PoseLandmarker loaded");
};
createPoseLandmarker();

// webcam availability
const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;
if (!hasGetUserMedia()) {
  console.warn("getUserMedia() is not supported by your browser");
} else {
  enableWebcamButton.addEventListener("click", enableCam);
}

function enableCam() {
  if (!poseLandmarker) {
    console.log("Wait! poseLandmarker not loaded yet.");
    return;
  }

  webcamRunning = !webcamRunning;
  enableWebcamButton.innerText = webcamRunning
    ? "DISABLE PREDICTIONS"
    : "ENABLE PREDICTIONS";

  if (webcamRunning) {
    navigator.mediaDevices.getUserMedia({ video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT } })
      .then((stream) => {
        video.srcObject = stream;
        video.play();
        video.addEventListener("loadeddata", () => {
          // start prediction loop
          window.requestAnimationFrame(predictWebcam);
        }, { once: true });
      })
      .catch((err) => console.error("getUserMedia error:", err));
  } else {
    // stop stream when disabling
    if (video.srcObject) {
      const tracks = video.srcObject.getTracks();
      tracks.forEach(t => t.stop());
      video.srcObject = null;
    }
    // clear canvas
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  }
}

const drawingUtils = new DrawingUtils(canvasCtx);

let lastVideoTime = -1;

async function predictWebcam() {
  // resize styling (CSS) for display; underlying canvas pixel size already set above
  canvasElement.style.width = `${VIDEO_WIDTH}px`;
  canvasElement.style.height = `${VIDEO_HEIGHT}px`;
  video.style.width = `${VIDEO_WIDTH}px`;
  video.style.height = `${VIDEO_HEIGHT}px`;

  // guard: only run if video has frames
  if (video.readyState < 2) {
    if (webcamRunning) window.requestAnimationFrame(predictWebcam);
    return;
  }

  // avoid duplicate processing for same frame
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    const startTimeMs = performance.now();
    try {
      // detectForVideo returns the result
      const result = await poseLandmarker.detectForVideo(video, startTimeMs);
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      if (result && result.landmarks && result.landmarks.length > 0) {
        // result.landmarks is an array of poses; take the first pose (index 0)
        const landmarks = result.landmarks[0];

        // draw landmarks and connectors
        drawingUtils.drawLandmarks(landmarks, {
          radius: (data) => DrawingUtils.lerp(data.from.z ?? 0, -0.15, 0.1, 5, 1)
        });

        // If library exposes POSE_CONNECTIONS, try to draw connectors; otherwise skip gracefully
        if (PoseLandmarker.POSE_CONNECTIONS) {
          drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS);
        }

        // indices (MediaPipe pose indexes)
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        const leftKnee = landmarks[25];
        const rightKnee = landmarks[26];
        const leftAnkle = landmarks[27];
        const rightAnkle = landmarks[28];

        // compute left knee angle (hip-knee-ankle)
        const kneeAngle = getAngle(leftHip, leftKnee, leftAnkle);
        // simple detection rule - adjust threshold to taste and maybe add smoothing
        if (kneeAngle < 90) {
          // You can replace with a UI update instead of console.log
          console.log("Split-squat / deep knee bend detected (left). Angle:", kneeAngle.toFixed(1));
        }

        // Arm distance example (wrists indices)
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];
        if (leftWrist && rightWrist) {
          const armDistance = getDistance(leftWrist, rightWrist);
          console.log("Arm distance (normalized screen coords):", armDistance.toFixed(3));
        }
      } else {
        // no pose detected this frame
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
