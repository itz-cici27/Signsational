// Hand tracking shared by the game and the recorder.
// MediaPipe Hand Landmarker runs fully in the browser: video never leaves the device.
import { FilesetResolver, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Pairs of landmark indices to draw the hand skeleton.
const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

// Letters track one hand; sign words track up to two (numHands: 2).
export async function createHandTracker({ numHands = 1 } = {}) {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numHands,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    return await HandLandmarker.createFromOptions(vision, options("GPU"));
  } catch (err) {
    console.warn("GPU delegate failed, falling back to CPU", err);
    return await HandLandmarker.createFromOptions(vision, options("CPU"));
  }
}

export async function startCamera(video) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
    audio: false,
  });
  video.srcObject = stream;
  await new Promise((resolve) => {
    if (video.readyState >= 1) resolve();
    else video.onloadedmetadata = resolve;
  });
  await video.play();
  return stream;
}

export function stopCamera(stream) {
  if (stream) stream.getTracks().forEach((t) => t.stop());
}

// Calls onFrame(landmarks or null, hands) once per new video frame. `landmarks` is the
// first hand found; `hands` is every hand found, as [{ lm, label }], where label is
// MediaPipe's "Left" or "Right" (the sign words use both hands). Returns a stop function.
export function runLoop(video, tracker, onFrame) {
  let running = true;
  let lastTime = -1;
  function tick() {
    if (!running) return;
    if (video.readyState >= 2 && video.currentTime !== lastTime) {
      lastTime = video.currentTime;
      const result = tracker.detectForVideo(video, performance.now());
      const sides = result.handedness || result.handednesses || [];
      const hands = (result.landmarks || []).map((lm, i) => ({ lm, label: sides[i]?.[0]?.categoryName || "Right" }));
      onFrame(hands.length ? hands[0].lm : null, hands);
    }
    requestAnimationFrame(tick);
  }
  tick();
  return () => {
    running = false;
  };
}

// Turns 21 landmarks into 63 numbers the model can use.
// Centered on the wrist and scaled by palm size, so hand position and
// distance from the camera don't matter. Left-handed signers are mirrored
// so their handshapes line up with right-handed training data.
export function toFeatures(lm, aspect = 4 / 3, leftHanded = false) {
  const wrist = lm[0];
  const dx = (lm[9].x - wrist.x) * aspect;
  const dy = lm[9].y - wrist.y;
  const size = Math.hypot(dx, dy) || 1;
  const flip = leftHanded ? -1 : 1;
  const out = [];
  for (const p of lm) {
    out.push(
      (flip * (p.x - wrist.x) * aspect) / size,
      (p.y - wrist.y) / size,
      ((p.z - wrist.z) * aspect) / size
    );
  }
  return out;
}

export function drawHand(ctx, lm, width, height, color = "#FF6FAE", clear = true) {
  if (clear) ctx.clearRect(0, 0, width, height);
  if (!lm) return;
  ctx.lineCap = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  for (const [a, b] of CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(lm[a].x * width, lm[a].y * height);
    ctx.lineTo(lm[b].x * width, lm[b].y * height);
    ctx.stroke();
  }
  ctx.lineWidth = 2.5;
  ctx.fillStyle = "#FFFFFF";
  for (const p of lm) {
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// Draws every tracked hand (the sign word pages track two). The second hand is lilac.
export function drawHands(ctx, hands, width, height) {
  ctx.clearRect(0, 0, width, height);
  hands.forEach((h, i) => drawHand(ctx, h.lm, width, height, i ? "#9B7BFF" : "#FF6FAE", false));
}
