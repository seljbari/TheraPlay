// GUI Controller
class GameGUI {
    constructor() {
        this.currentGame = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Game selection
        document.getElementById('game4-btn').addEventListener('click', () => {
            this.startGame4();
        });

        // Game controls
        document.getElementById('restart-btn').addEventListener('click', () => {
            if (this.currentGame) {
                this.currentGame.restart();
            }
        });

        document.getElementById('quit-btn').addEventListener('click', () => {
            this.quitGame();
        });

        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            if (event.key.toLowerCase() === 'r' && this.currentGame) {
                this.currentGame.restart();
            } else if (event.key.toLowerCase() === 'q') {
                this.quitGame();
            }
        });
    }

    startGame4() {
        document.querySelector('.game-selector').style.display = 'none';
        document.getElementById('game4-container').style.display = 'block';
        
        this.currentGame = new PongGame();
        this.currentGame.initialize();
    }

    quitGame() {
        if (this.currentGame) {
            this.currentGame.cleanup();
            this.currentGame = null;
        }
        
        document.querySelector('.game-selector').style.display = 'block';
        document.getElementById('game4-container').style.display = 'none';
    }
}

// Initialize GUI when page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameGUI();
});
