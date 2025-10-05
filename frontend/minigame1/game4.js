class PongGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('video');
        
        // Default speeds
        this.defaultSpeedX = 9;
        this.defaultSpeedY = 9;
        
        // Game variables
        this.ballPos = [100, 100];
        this.speedX = this.defaultSpeedX;
        this.speedY = this.defaultSpeedY;
        this.gameOver = false;
        this.gameState = 'playing';
        this.score = [0, 0];
        this.animationId = null;
        this.winner = ""; // Added winner tracking
        
        // Images
        this.images = {};
        this.poseDetector = null;
        this.camera = null;
        
        // Bat dimensions (approximate from original)
        this.batWidth = 50;
        this.batHeight = 150;
        
        // Player and AI positions
        this.playerBatY = 360;  // Player controlled by chest
        this.aiBatY = 360;      // AI controlled
        this.poseDetected = false;
        
        // AI variables
        this.aiSpeed = 8;       // AI paddle speed
        this.aiReactionDelay = 5; // Frames of delay for AI reaction
        this.aiDelayCounter = 0;
        this.aiTargetY = 360;
    }

    async initialize() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        console.log("Pong with Computer Vision - Chest Control vs AI");
        
        // Load images
        await this.loadImages();
        
        // Initialize MediaPipe Pose
        await this.initializePoseDetection();
        
        // Start camera
        await this.startCamera();
        
        // Start game loop
        this.gameLoop();
    }

    async loadImages() {
        const imageUrls = {
            background: 'Resources/Background.png',
            gameOver: 'Resources/gameOver.png',
            ball: 'Resources/Ball.png',
            bat1: 'Resources/bat1.png',
            bat2: 'Resources/bat2.png'
        };

        for (const [key, url] of Object.entries(imageUrls)) {
            this.images[key] = new Image();
            this.images[key].src = url;
            await new Promise((resolve) => {
                this.images[key].onload = resolve;
            });
        }
    }

    async initializePoseDetection() {
        this.poseDetector = new Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });

        this.poseDetector.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.8,
            minTrackingConfidence: 0.5
        });

        this.poseDetector.onResults(this.onPoseResults.bind(this));
    }

    async startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 1280, height: 720 } 
            });
            
            this.video.srcObject = stream;
            
            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    await this.poseDetector.send({ image: this.video });
                },
                width: 1280,
                height: 720
            });
            
            this.camera.start();
        } catch (error) {
            console.error('Error accessing camera:', error);
        }
    }

    onPoseResults(results) {
        if (results.poseLandmarks) {
            this.poseDetected = true;
            
            // Get chest position - midpoint between left shoulder (11) and right shoulder (12)
            const leftShoulder = results.poseLandmarks[11];
            const rightShoulder = results.poseLandmarks[12];
            
            if (leftShoulder && rightShoulder) {
                const avgChestY = ((leftShoulder.y + rightShoulder.y) / 2) * this.canvas.height;
                
                // Constrain Y position for player paddle
                this.playerBatY = Math.max(20, Math.min(415, avgChestY - this.batHeight / 2));
            }
        } else {
            this.poseDetected = false;
        }
    }

    // rest of your code unchanged...
    updateAI() {
        // AI follows the ball with some delay and imperfection
        this.aiDelayCounter++;
        
        if (this.aiDelayCounter >= this.aiReactionDelay) {
            this.aiTargetY = this.ballPos[1] - this.batHeight / 2;
            this.aiTargetY += (Math.random() - 0.5) * 40;
            this.aiTargetY = Math.max(20, Math.min(415, this.aiTargetY));
            this.aiDelayCounter = 0;
        }
        
        const diff = this.aiTargetY - this.aiBatY;
        if (Math.abs(diff) > this.aiSpeed) {
            this.aiBatY += Math.sign(diff) * this.aiSpeed;
        } else {
            this.aiBatY = this.aiTargetY;
        }
        
        this.aiBatY = Math.max(20, Math.min(415, this.aiBatY));
    }

    checkBallCollision() {
        const ballX = this.ballPos[0];
        const ballY = this.ballPos[1];
        
        const playerBatX = 59;
        if (playerBatX < ballX && ballX < playerBatX + this.batWidth && 
            this.playerBatY < ballY && ballY < this.playerBatY + this.batHeight) {
            this.speedX = Math.abs(this.speedX);
            this.ballPos[0] = playerBatX + this.batWidth + 5;
            this.score[0] += 1;
            const hitPosition = (ballY - this.playerBatY) / this.batHeight;
            this.speedY += (hitPosition - 0.5) * 10;
        }
        
        const aiBatX = 1195;
        if (aiBatX - 50 < ballX && ballX < aiBatX && 
            this.aiBatY < ballY && ballY < this.aiBatY + this.batHeight) {
            this.speedX = -Math.abs(this.speedX);
            this.ballPos[0] = aiBatX - 50 - 5;
            this.score[1] += 1;
            const hitPosition = (ballY - this.aiBatY) / this.batHeight;
            this.speedY += (hitPosition - 0.5) * 8;
        }
    }

    gameLoop() {
        this.update();
        this.render();
        this.animationId = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        if (this.gameState !== 'playing') return;

        this.updateAI();

        if (this.ballPos[0] < 40) {
            this.gameState = 'gameOver';
            this.gameOver = true;
            this.winner = "AI";
            return;
        }
        if (this.ballPos[0] > 1200) {
            this.gameState = 'gameOver';
            this.gameOver = true;
            this.winner = "Player";
            return;
        }

        if (this.ballPos[1] >= 500 || this.ballPos[1] <= 10) {
            this.speedY = -this.speedY;
        }

        this.checkBallCollision();

        this.ballPos[0] += this.speedX;
        this.ballPos[1] += this.speedY;

        this.speedY = Math.max(-20, Math.min(20, this.speedY));
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.globalAlpha = 0.2;
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

        this.ctx.globalAlpha = 0.8;
        this.ctx.drawImage(this.images.background, 0, 0, this.canvas.width, this.canvas.height);

        this.ctx.globalAlpha = 1.0;

        if (this.gameOver) {
            this.renderGameOver();
        } else {
            this.renderGame();
        }

        this.ctx.drawImage(this.video, 20, 580, 213, 120);
    }

    renderGame() {
        if (this.poseDetected) {
            this.ctx.drawImage(this.images.bat1, 59, this.playerBatY);
        }
        this.ctx.drawImage(this.images.bat2, 1195, this.aiBatY);

        this.ctx.drawImage(this.images.ball, this.ballPos[0], this.ballPos[1]);

        this.ctx.font = "48px Arial";
        this.ctx.fillStyle = "white";
        this.ctx.strokeStyle = "black";
        this.ctx.lineWidth = 5;
        this.ctx.strokeText(this.score[0].toString(), 300, 650);
        this.ctx.fillText(this.score[0].toString(), 300, 650);
        this.ctx.strokeText(this.score[1].toString(), 900, 650);
        this.ctx.fillText(this.score[1].toString(), 900, 650);

        if (!this.poseDetected) {
            this.ctx.font = "24px Arial";
            this.ctx.fillStyle = "#ff6b6b";
            this.ctx.strokeText("Move your body to control the left paddle!", 350, 50);
            this.ctx.fillText("Move your body to control the left paddle!", 350, 50);
        } else {
            this.ctx.font = "20px Arial";
            this.ctx.fillStyle = "#4CAF50";
            this.ctx.strokeText("Player vs AI - Move your hips to control paddle!", 400, 50);
            this.ctx.fillText("Player vs AI - Move your hips to control paddle!", 400, 50);
        }

        document.getElementById('score-left').textContent = this.score[0];
        document.getElementById('score-right').textContent = this.score[1];
    }

    renderGameOver() {
        this.ctx.drawImage(this.images.gameOver, 0, 0, this.canvas.width, this.canvas.height);

        const finalScore = (this.score[0]).toString().padStart(2, '0');
        this.ctx.font = "40px Arial";
        this.ctx.fillStyle = "#c800c8";
        this.ctx.strokeText(finalScore, 617, 345);
        this.ctx.fillText(finalScore, 617, 345);

        const winnerText = (this.winner === "Player") ? "You Win!" : "AI Wins!";
        this.ctx.font = "32px Arial";
        this.ctx.fillStyle = "#FFD700";
        this.ctx.strokeText(winnerText, 580, 490);
        this.ctx.fillText(winnerText, 580, 490);
    }

    restart() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        this.ballPos = [100, 100];
        this.speedX = this.defaultSpeedX;
        this.speedY = this.defaultSpeedY;

        this.gameOver = false;
        this.gameState = 'playing';
        this.score = [0, 0];
        this.winner = "";

        this.aiBatY = 360;
        this.playerBatY = 360;
        this.aiDelayCounter = 0;

        console.log("Game restarted at speed", this.speedX, this.speedY);

        this.gameLoop();
    }

    cleanup() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.camera) {
            this.camera.stop();
        }
        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }
        if (this.poseDetector) {
            this.poseDetector.close();
        }
    }
}
