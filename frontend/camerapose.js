// Camera and Pose Detection - Shared across all exercises
class CameraPoseDetector {
  constructor(videoElement, canvasElement, onPoseCallback) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.onPoseCallback = onPoseCallback;
    this.pose = null;
    this.camera = null;
    this.ctx = canvasElement.getContext('2d');
    this.animationId = null;
  }

  async initialize() {
    try {
      // Load MediaPipe Pose scripts
      await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
      await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
      
      // Initialize Pose
      this.pose = new window.Pose({
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

      return true;
    } catch (error) {
      console.error('Error initializing pose detector:', error);
      throw error;
    }
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if script already loaded
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async start() {
    try {
      if (!this.pose) {
        await this.initialize();
      }

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: 'user'
        }
      });

      this.video.srcObject = stream;
      
      // Wait for video to be ready
      await new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          resolve();
        };
      });

      // Set canvas size to match video
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;

      // Start processing frames
      this.processFrame();

      return true;
    } catch (error) {
      console.error('Error starting camera:', error);
      throw error;
    }
  }

  async processFrame() {
    if (!this.video || this.video.paused || this.video.ended) {
      return;
    }

    try {
      await this.pose.send({ image: this.video });
    } catch (error) {
      console.error('Error processing frame:', error);
    }

    // Continue processing
    this.animationId = requestAnimationFrame(() => this.processFrame());
  }

  stop() {
    // Stop animation loop
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Stop video stream
    if (this.video && this.video.srcObject) {
      const tracks = this.video.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      this.video.srcObject = null;
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
      
      if (startPoint && endPoint) {
        this.ctx.beginPath();
        this.ctx.moveTo(startPoint.x * this.canvas.width, startPoint.y * this.canvas.height);
        this.ctx.lineTo(endPoint.x * this.canvas.width, endPoint.y * this.canvas.height);
        this.ctx.stroke();
      }
    });

    // Draw key points
    this.ctx.fillStyle = '#FF0000';
    landmarks.forEach((landmark) => {
      if (landmark) {
        this.ctx.beginPath();
        this.ctx.arc(
          landmark.x * this.canvas.width,
          landmark.y * this.canvas.height,
          5,
          0,
          2 * Math.PI
        );
        this.ctx.fill();
      }
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