// frontend/plank/plankmodel.js
// Scoring plank form using MediaPipe Pose landmarks.
// Exporting `scorePlank(landmarks, { ctx, canvas, ui, nowMs })`
// - landmarks: results.poseLandmarks from MediaPipe
// - ctx, canvas: drawing context/layer already set by webcam.js
// - ui: object from initPlankUI with setStatus/setScore/setTimer/setTip
// - nowMs: performance.now() value for timing

// Defining BlazePose landmark indices (using v0.5)
const IDX = {
  NOSE: 0,
  LEFT_EYE_INNER: 1, LEFT_EYE: 2, LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4, RIGHT_EYE: 5, RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7, RIGHT_EAR: 8,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
};

// Module-level state (persisting across frames)
let holdStartMs = null;
let lastGoodForm = false;

// Public entry point
export function scorePlank(landmarks, { ctx, canvas, ui, nowMs }) {
  // Guarding against missing pose
  if (!landmarks || landmarks.length < 33) {
    ui?.setStatus?.("Detecting body…");
    ui?.setTip?.("Making sure your full body is in frame");
    _resetHold(nowMs);
    return;
  }

  // Converting normalized coords to pixels
  const px = (i) => toPixels(landmarks[i], canvas);

  const left = {
    shoulder: px(IDX.LEFT_SHOULDER),
    elbow:    px(IDX.LEFT_ELBOW),
    wrist:    px(IDX.LEFT_WRIST),
    hip:      px(IDX.LEFT_HIP),
    knee:     px(IDX.LEFT_KNEE),
    ankle:    px(IDX.LEFT_ANKLE),
  };
  const right = {
    shoulder: px(IDX.RIGHT_SHOULDER),
    elbow:    px(IDX.RIGHT_ELBOW),
    wrist:    px(IDX.RIGHT_WRIST),
    hip:      px(IDX.RIGHT_HIP),
    knee:     px(IDX.RIGHT_KNEE),
    ankle:    px(IDX.RIGHT_ANKLE),
  };

  // Computing joint-line angles for body alignment
  // Measuring hip-line straightness: angle at hip formed by shoulder-hip-ankle (~180° when straight)
  const hipAngleLeft  = angleDeg(left.shoulder, left.hip, left.ankle);
  const hipAngleRight = angleDeg(right.shoulder, right.hip, right.ankle);
  const hipAngleAvg   = averagePresent([hipAngleLeft, hipAngleRight]);

  // Measuring head alignment gently (optional): shoulder-hip vs hip-ankle vector collinearity
  const straightnessScore = lineCollinearityScore(
    midpoint(left.shoulder, right.shoulder),
    midpoint(left.hip, right.hip),
    midpoint(left.ankle, right.ankle)
  );

  // Checking elbows under shoulders (forearm plank cue)
  const elbowUnderShoulderScore = horizontalStackScore(left, right);

  // Combining into a simple 0–100 form score
  // - Penalizing deviation from 180° at hip (sag or pike)
  // - Weighing straightness + elbow stacking
  const hipPenalty = clamp01(Math.abs(180 - hipAngleAvg) / 20); // 0 at 180°, 1 at ≥20°
  const baseScore =
    100
    - (hipPenalty * 70)                // penalizing hip deviation strongly
    + (straightnessScore * 20)         // rewarding overall straight line
    + (elbowUnderShoulderScore * 10);  // rewarding stacking

  const formScore = clamp(0, 100, baseScore);

  // Drawing quick overlays (optional)
  drawLine(ctx, left.shoulder, left.ankle);
  drawLine(ctx, right.shoulder, right.ankle);
  drawPoint(ctx, left.hip); drawPoint(ctx, right.hip);

  // Updating UI
  ui?.setScore?.(formScore);

  // Managing hold timer when form is "good"
  const isGood = formScore >= 75;
  if (isGood) {
    ui?.setStatus?.("Holding good form");
    ui?.setTip?.("Keeping head–hip–ankle in one line; stacking elbows under shoulders");
    _startOrContinueHold(nowMs);
  } else {
    ui?.setStatus?.("Fixing form…");
    ui?.setTip?.(_tipFromMetrics(hipAngleAvg, straightnessScore, elbowUnderShoulderScore));
    _resetHold(nowMs);
  }

  // Updating timer in UI
  if (holdStartMs) {
    const seconds = (nowMs - holdStartMs) / 1000;
    ui?.setTimer?.(seconds);
  } else {
    ui?.setTimer?.(0);
  }
}

/* ----------------- Helpers (geometry, scoring, drawing) ------------------ */

// Converting normalized landmark to pixel coords
function toPixels(lm, canvas) {
  if (!lm) return null;
  return {
    x: lm.x * canvas.width,
    y: lm.y * canvas.height,
    v: lm.visibility ?? 1.0,
  };
}

// Computing angle at point B given A-B-C (degrees)
function angleDeg(a, b, c) {
  if (!a || !b || !c) return null;
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mab = Math.hypot(ab.x, ab.y);
  const mcb = Math.hypot(cb.x, cb.y);
  if (mab === 0 || mcb === 0) return null;
  const cos = clamp(-1, 1, dot / (mab * mcb));
  return (Math.acos(cos) * 180) / Math.PI;
}

// Averaging only defined numbers
function averagePresent(values) {
  const nums = values.filter((v) => typeof v === "number" && isFinite(v));
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Computing straightness based on three points (shoulders → hips → ankles)
// Returning score in [0,1], where 1 = very straight
function lineCollinearityScore(shoulders, hips, ankles) {
  if (!shoulders || !hips || !ankles) return 0;
  // Computing angle at hips for midline (shoulders-hips-ankles)
  const midAngle = angleDeg(shoulders, hips, ankles);
  if (midAngle == null) return 0;
  const deviation = Math.abs(180 - midAngle);
  return 1 - clamp01(deviation / 20); // full credit if within 0–5°, tapering to 0 at 20°
}

// Checking if elbows are roughly under shoulders horizontally
function horizontalStackScore(l, r) {
  if (!l || !r) return 0;
  const dxL = Math.abs((l.elbow?.x ?? 0) - (l.shoulder?.x ?? 0));
  const dxR = Math.abs((r.elbow?.x ?? 0) - (r.shoulder?.x ?? 0));
  const span = Math.abs((l.shoulder?.x ?? 0) - (r.shoulder?.x ?? 0)) || 1;
  const norm = ((dxL + dxR) / 2) / span; // 0 means stacked; larger means off
  return 1 - clamp01(norm / 0.15);       // giving full credit if within ~15% of shoulder width
}

function midpoint(a, b) {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function clamp(min, max, v) { return Math.max(min, Math.min(max, v)); }
function clamp01(v)         { return clamp(0, 1, v); }

// Drawing helpers
function drawLine(ctx, a, b) {
  if (!a || !b) return;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineWidth = 2;
  ctx.stroke();
}
function drawPoint(ctx, p, r = 4) {
  if (!p) return;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
}

/* ----------------------- Hold timer state handling ----------------------- */

function _startOrContinueHold(nowMs) {
  // Starting hold if needed, otherwise keeping it going
  if (!holdStartMs) holdStartMs = nowMs;
  lastGoodForm = true;
}

function _resetHold(nowMs) {
  // Resetting timer when losing form
  holdStartMs = null;
  lastGoodForm = false;
}

/* ----------------------------- Tip builder ------------------------------- */

function _tipFromMetrics(hipAngleAvg, straightnessScore, elbowScore) {
  const tips = [];
  if (hipAngleAvg && Math.abs(180 - hipAngleAvg) > 10) {
    tips.push(hipAngleAvg < 180 ? "Raising hips slightly (avoiding sag)" : "Lowering hips slightly (avoiding pike)");
  }
  if (straightnessScore < 0.7) {
    tips.push("Keeping head–hip–ankle aligned");
  }
  if (elbowScore < 0.7) {
    tips.push("Stacking elbows under shoulders");
  }
  return tips[0] || "Maintaining straight line from head to heels";
}
