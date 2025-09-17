// Main application entry point
class Chess2App {
    constructor() {
        this.socket = null;
        this.currentPlayer = null;
        this.gameBoard = null;
        this.ui = null;
        
        this.screens = {
            loading: document.getElementById('loading-screen'),
            join: document.getElementById('join-screen'),
            game: document.getElementById('game-screen'),
            gameFull: document.getElementById('game-full-screen'),
            connectionError: document.getElementById('connection-error-screen')
        };

        this.init();
    }

    init() {
        this.showScreen('loading');
        this.setupEventListeners();
        this.connectToServer();
    }

    setupEventListeners() {
        // Join screen
        const joinBtn = document.getElementById('join-btn');
        const playerNameInput = document.getElementById('player-name');
        
        joinBtn.addEventListener('click', () => this.joinGame());
        playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });

        // Error screen buttons
        document.getElementById('refresh-btn')?.addEventListener('click', () => {
            window.location.reload();
        });

        document.getElementById('retry-btn')?.addEventListener('click', () => {
            this.showScreen('loading');
            this.connectToServer();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.gameBoard) {
                switch(e.code) {
                    case 'Space':
                        e.preventDefault();
                        this.gameBoard.centerOnPlayerPieces();
                        break;
                    case 'Equal':
                    case 'NumpadAdd':
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            this.gameBoard.zoomIn();
                        }
                        break;
                    case 'Minus':
                    case 'NumpadSubtract':
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            this.gameBoard.zoomOut();
                        }
                        break;
                }
            }
        });
    }

    connectToServer() {
        try {
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('Connected to server');
                this.showScreen('join');
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from server');
                this.showToast('Connection lost', 'error');
            });

            this.socket.on('connect_error', () => {
                console.error('Connection failed');
                this.showScreen('connectionError');
            });

            this.setupGameSocketEvents();

        } catch (error) {
            console.error('Failed to connect:', error);
            this.showScreen('connectionError');
        }
    }

    setupGameSocketEvents() {
        // Game events
        this.socket.on('game-joined', (data) => {
            this.currentPlayer = data.player;
            this.initGame(data);
        });

        this.socket.on('game-full', () => {
            this.showScreen('gameFull');
        });

        this.socket.on('player-joined', (player) => {
            this.showToast(`${player.name} joined the game`, 'success');
            if (this.ui) {
                this.ui.addPlayer(player);
            }
        });

        this.socket.on('player-left', (playerId) => {
            if (this.ui) {
                const player = this.ui.removePlayer(playerId);
                if (player) {
                    this.showToast(`${player.name} left the game`, 'warning');
                }
            }
        });

        this.socket.on('piece-moved', (moveData) => {
            if (this.gameBoard) {
                this.gameBoard.handlePieceMoved(moveData);
            }
        });

        this.socket.on('invalid-move', (message) => {
            this.showToast(message, 'error');
        });
        
        this.socket.on('move-on-cooldown', (data) => {
            this.showToast(data.message, 'warning');
            if (this.gameBoard) {
                this.gameBoard.startCooldown(data.remainingMs);
            }
        });

        this.socket.on('board-section', (data) => {
            if (this.gameBoard) {
                this.gameBoard.updateBoardSection(data);
            }
        });
    }

    joinGame() {
        const playerNameInput = document.getElementById('player-name');
        const playerName = playerNameInput.value.trim() || `Player${Date.now()}`;
        
        if (this.socket && this.socket.connected) {
            this.socket.emit('join-game', playerName);
        } else {
            this.showToast('Not connected to server', 'error');
        }
    }

    initGame(gameData) {
        this.showScreen('game');
        
        // Initialize game components
        this.gameBoard = new GameBoard(this.socket, gameData.board, this.currentPlayer);
        this.ui = new GameUI(this.currentPlayer, gameData.players);
        
        // Update player info
        document.getElementById('player-info').textContent = 
            `Playing as ${this.currentPlayer.name}`;
        
        // Set player color indicator
        const colorIndicator = document.getElementById('your-color');
        colorIndicator.style.backgroundColor = this.currentPlayer.color;
        
        // Setup game controls
        this.setupGameControls();
        
        this.showToast(`Welcome to Chess 2, ${this.currentPlayer.name}!`, 'success');
    }

    setupGameControls() {
        // Desktop controls
        document.getElementById('center-board').addEventListener('click', () => {
            this.gameBoard.centerOnPlayerPieces();
        });

        document.getElementById('toggle-minimap').addEventListener('click', () => {
            this.ui.toggleMinimap();
        });

        document.getElementById('zoom-in').addEventListener('click', () => {
            this.gameBoard.zoomIn();
        });

        document.getElementById('zoom-out').addEventListener('click', () => {
            this.gameBoard.zoomOut();
        });

        // Mobile controls
        document.getElementById('mobile-center').addEventListener('click', () => {
            this.gameBoard.centerOnPlayerPieces();
        });

        document.getElementById('mobile-zoom-in').addEventListener('click', () => {
            this.gameBoard.zoomIn();
        });

        document.getElementById('mobile-zoom-out').addEventListener('click', () => {
            this.gameBoard.zoomOut();
        });

        document.getElementById('mobile-minimap').addEventListener('click', () => {
            this.ui.toggleMinimap();
        });

        document.getElementById('mobile-players').addEventListener('click', () => {
            this.ui.togglePlayersPanel();
        });

        // Minimap controls
        document.getElementById('close-minimap').addEventListener('click', () => {
            this.ui.hideMinimap();
        });
    }

    showScreen(screenName) {
        Object.keys(this.screens).forEach(name => {
            if (name === screenName) {
                this.screens[name].classList.remove('hidden');
            } else {
                this.screens[name].classList.add('hidden');
            }
        });
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chess2App = new Chess2App();
});
