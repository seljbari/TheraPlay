import { Pose } from "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/pose.js";
import { POSE_CONNECTIONS } from "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/pose_connections.js";
import { drawConnectors, drawLandmarks } from "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3/drawing_utils.js";

export function createPose(onResults) {
  const pose = new Pose({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${f}`,
  });
  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });
  pose.onResults(onResults);
  return pose;
}

export function drawPose(ctx, results) {
  if (!results.poseLandmarks) return;
  drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS);
  drawLandmarks(ctx, results.poseLandmarks);
}
