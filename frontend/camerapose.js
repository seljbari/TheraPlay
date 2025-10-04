// Camera and Pose Detection - Shared across all exercises
class CameraPoseDetector {
  constructor(videoElement, canvasElement, onPoseCallback) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.onPoseCallback = onPoseCallback;
    this.pose = null;
    this.camera = null;
    this.ctx = canvasElement.getContext('2d');
  }

  async initialize() {
    // Import MediaPipe Pose
    const { Pose } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
    const { Camera } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');

    // Initialize Pose
    this.pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    // Set up results callback
    this.pose.onResults((results) => this.onResults(results));

    // Start camera
    this.camera = new Camera(this.video, {
      onFrame: async () => {
        await this.pose.send({ image: this.video });
      },
      width: 640,
      height: 480
    });
  }

  async start() {
    if (!this.camera) {
      await this.initialize();
    }
    await this.camera.start();
  }

  stop() {
    if (this.camera) {
      this.camera.stop();
    }
  }

  onResults(results) {
    // Clear canvas
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw video frame
    this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);

    // Draw pose landmarks if detected
    if (results.poseLandmarks) {
      this.drawPose(results.poseLandmarks);
      
      // Call the exercise-specific callback
      if (this.onPoseCallback) {
        this.onPoseCallback(results.poseLandmarks);
      }
    }

    this.ctx.restore();
  }

  drawPose(landmarks) {
    // Draw connections
    const connections = [
      [11, 12], // shoulders
      [11, 13], [13, 15], // left arm
      [12, 14], [14, 16], // right arm
      [11, 23], [12, 24], // torso
      [23, 24], // hips
      [23, 25], [25, 27], // left leg
      [24, 26], [26, 28], // right leg
    ];

    this.ctx.strokeStyle = '#00FF00';
    this.ctx.lineWidth = 3;

    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start];
      const endPoint = landmarks[end];
      
      this.ctx.beginPath();
      this.ctx.moveTo(startPoint.x * this.canvas.width, startPoint.y * this.canvas.height);
      this.ctx.lineTo(endPoint.x * this.canvas.width, endPoint.y * this.canvas.height);
      this.ctx.stroke();
    });

    // Draw key points
    this.ctx.fillStyle = '#FF0000';
    landmarks.forEach((landmark) => {
      this.ctx.beginPath();
      this.ctx.arc(
        landmark.x * this.canvas.width,
        landmark.y * this.canvas.height,
        5,
        0,
        2 * Math.PI
      );
      this.ctx.fill();
    });
  }

  // Helper function to calculate angle between three points
  static calculateAngle(point1, point2, point3) {
    const radians = Math.atan2(point3.y - point2.y, point3.x - point2.x) -
                    Math.atan2(point1.y - point2.y, point1.x - point2.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) {
      angle = 360 - angle;
    }
    return angle;
  }
}