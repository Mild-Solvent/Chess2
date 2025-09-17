// UI management for players, minimap, and interface
class GameUI {
    constructor(currentPlayer, initialPlayers) {
        this.currentPlayer = currentPlayer;
        this.players = new Map();
        
        this.elements = {
            playersList: document.getElementById('players-list'),
            playersCount: document.getElementById('players-count'),
            minimapContainer: document.getElementById('minimap-container'),
            minimap: document.getElementById('minimap'),
            sidePanel: document.getElementById('side-panel')
        };
        
        this.minimapCtx = this.elements.minimap.getContext('2d');
        this.minimapVisible = false;
        
        this.init(initialPlayers);
    }
    
    init(initialPlayers) {
        // Load initial players
        initialPlayers.forEach(player => {
            this.players.set(player.id, player);
        });
        
        this.updatePlayersDisplay();
        this.setupMinimap();
    }
    
    addPlayer(player) {
        this.players.set(player.id, player);
        this.updatePlayersDisplay();
    }
    
    removePlayer(playerId) {
        const player = this.players.get(playerId);
        this.players.delete(playerId);
        this.updatePlayersDisplay();
        return player;
    }
    
    updatePlayersDisplay() {
        const playersList = this.elements.playersList;
        const playersCount = this.elements.playersCount;
        
        // Update count
        playersCount.textContent = `(${this.players.size})`;
        
        // Clear current list
        playersList.innerHTML = '';
        
        // Sort players (current player first, then by join time)
        const sortedPlayers = Array.from(this.players.values()).sort((a, b) => {
            if (a.id === this.currentPlayer.id) return -1;
            if (b.id === this.currentPlayer.id) return 1;
            return a.joinedAt - b.joinedAt;
        });
        
        // Add players to list
        sortedPlayers.forEach(player => {
            const playerElement = this.createPlayerElement(player);
            playersList.appendChild(playerElement);
        });
    }
    
    createPlayerElement(player) {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        playerDiv.dataset.playerId = player.id;
        
        // Color indicator
        const colorDiv = document.createElement('div');
        colorDiv.className = 'player-color';
        colorDiv.style.backgroundColor = player.color;
        
        // Player name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-name';
        nameSpan.textContent = player.name;
        
        // Add \"You\" indicator for current player
        if (player.id === this.currentPlayer.id) {
            nameSpan.textContent += ' (You)';
            playerDiv.style.background = 'rgba(255, 255, 255, 0.2)';
        }
        
        // Status indicator
        const statusSpan = document.createElement('span');
        statusSpan.className = 'player-status';
        statusSpan.textContent = player.isActive ? '●' : '○';
        statusSpan.style.color = player.isActive ? '#4caf50' : '#666';
        
        playerDiv.appendChild(colorDiv);
        playerDiv.appendChild(nameSpan);
        playerDiv.appendChild(statusSpan);
        
        return playerDiv;
    }
    
    setupMinimap() {
        // Initialize minimap
        this.resizeMinimap();
        this.updateMinimap();
        
        // Update minimap periodically
        setInterval(() => {
            if (this.minimapVisible) {
                this.updateMinimap();
            }
        }, 2000);
    }
    
    resizeMinimap() {
        const canvas = this.elements.minimap;
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = 200 * dpr;
        canvas.height = 150 * dpr;
        canvas.style.width = '200px';
        canvas.style.height = '150px';
        
        this.minimapCtx.scale(dpr, dpr);
    }
    
    updateMinimap() {
        if (!window.chess2App || !window.chess2App.gameBoard) return;
        
        const board = window.chess2App.gameBoard;
        const ctx = this.minimapCtx;
        
        // Clear minimap
        ctx.clearRect(0, 0, 200, 150);
        
        // Draw background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, 200, 150);
        
        // Find bounds of all pieces
        const pieces = Array.from(board.pieces.values());
        if (pieces.length === 0) return;
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        pieces.forEach(piece => {
            minX = Math.min(minX, piece.x);
            maxX = Math.max(maxX, piece.x);
            minY = Math.min(minY, piece.y);
            maxY = Math.max(maxY, piece.y);
        });
        
        // Add padding
        const padding = 5;
        minX -= padding;
        maxX += padding;
        minY -= padding;
        maxY += padding;
        
        // Calculate scale to fit in minimap
        const worldWidth = maxX - minX;
        const worldHeight = maxY - minY;
        const scaleX = 200 / worldWidth;
        const scaleY = 150 / worldHeight;
        const scale = Math.min(scaleX, scaleY);
        
        // Calculate offset to center the world
        const offsetX = (200 - worldWidth * scale) / 2 - minX * scale;
        const offsetY = (150 - worldHeight * scale) / 2 - minY * scale;
        
        // Draw pieces
        pieces.forEach(piece => {
            const x = piece.x * scale + offsetX;
            const y = piece.y * scale + offsetY;
            const size = Math.max(2, scale);
            
            ctx.fillStyle = piece.color;
            ctx.fillRect(x - size/2, y - size/2, size, size);
        });
        
        // Draw current view rectangle
        const viewBounds = board.getVisibleBounds();
        const viewX1 = viewBounds.minX * scale + offsetX;
        const viewY1 = viewBounds.minY * scale + offsetY;
        const viewX2 = viewBounds.maxX * scale + offsetX;
        const viewY2 = viewBounds.maxY * scale + offsetY;
        
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 1;
        ctx.strokeRect(viewX1, viewY1, viewX2 - viewX1, viewY2 - viewY1);
        
        // Draw origin marker
        const originX = 0 * scale + offsetX;
        const originY = 0 * scale + offsetY;
        
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(originX - 1, originY - 1, 2, 2);
    }
    
    toggleMinimap() {
        if (this.minimapVisible) {
            this.hideMinimap();
        } else {
            this.showMinimap();
        }
    }
    
    showMinimap() {
        this.elements.minimapContainer.classList.remove('hidden');
        this.minimapVisible = true;
        this.updateMinimap();
    }
    
    hideMinimap() {
        this.elements.minimapContainer.classList.add('hidden');
        this.minimapVisible = false;
    }
    
    togglePlayersPanel() {
        // For mobile - toggle side panel visibility
        const sidePanel = this.elements.sidePanel;
        
        if (window.innerWidth <= 768) {
            if (sidePanel.style.display === 'none') {
                sidePanel.style.display = 'block';
                sidePanel.style.position = 'fixed';
                sidePanel.style.top = '60px';
                sidePanel.style.left = '0';
                sidePanel.style.zIndex = '200';
                sidePanel.style.width = '100%';
                sidePanel.style.height = 'auto';
                sidePanel.style.maxHeight = '50vh';
            } else {
                sidePanel.style.display = '';
                sidePanel.style.position = '';
                sidePanel.style.top = '';
                sidePanel.style.left = '';
                sidePanel.style.zIndex = '';
                sidePanel.style.width = '';
                sidePanel.style.height = '';
                sidePanel.style.maxHeight = '';
            }
        }
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Add to UI (you could add a notifications container)
        console.log(`Notification (${type}): ${message}`);
    }
    
    updateGameInfo(info) {
        // Update various game info displays
        if (info.playersCount) {
            this.elements.playersCount.textContent = `(${info.playersCount})`;
        }
        
        // Could add more info updates here like:
        // - Current turn
        // - Game phase
        // - Board statistics
    }
    
    // Helper methods for mobile responsiveness
    isMobile() {
        return window.innerWidth <= 768;
    }
    
    setupResponsiveHandlers() {
        window.addEventListener('resize', () => {
            if (!this.isMobile()) {
                // Reset side panel styles when not mobile
                const sidePanel = this.elements.sidePanel;
                sidePanel.style.display = '';
                sidePanel.style.position = '';
                sidePanel.style.top = '';
                sidePanel.style.left = '';
                sidePanel.style.zIndex = '';
                sidePanel.style.width = '';
                sidePanel.style.height = '';
                sidePanel.style.maxHeight = '';
            }
        });
    }
}
