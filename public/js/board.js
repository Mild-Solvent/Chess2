// Chess board rendering and interaction
class GameBoard {
    constructor(socket, initialBoard, player) {
        this.socket = socket;
        this.player = player;
        this.canvas = document.getElementById('chess-board');
        this.ctx = this.canvas.getContext('2d');
        
        // Board state
        this.pieces = new Map();
        this.selectedPiece = null;
        this.validMoves = [];
        
        // View settings
        this.cellSize = 40;
        this.offsetX = 0;
        this.offsetY = 0;
        this.zoom = 1;
        this.minZoom = 0.2;
        this.maxZoom = 3;
        
        // Interaction state
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // Cooldown state
        this.isOnCooldown = false;
        this.cooldownEndTime = 0;
        this.cooldownTimer = null;
        
        // Pawn duplication state
        this.duplicatingPawns = new Map(); // Track which pawns are duplicating
        this.selectedPawnForDuplication = null;
        
        // Chess piece symbols (Unicode)
        this.pieceSymbols = {
            king: '♔',
            queen: '♕',
            rook: '♖',
            bishop: '♗',
            knight: '♘',
            pawn: '♙'
        };
        
        this.init(initialBoard);
    }
    
    init(initialBoard) {
        this.resizeCanvas();
        this.loadBoardPieces(initialBoard);
        this.setupEventListeners();
        this.centerOnPlayerPieces();
        this.render();
        
        // Request board updates periodically
        this.setupBoardUpdates();
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        
        // Handle high DPI displays
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width *= dpr;
        this.canvas.height *= dpr;
        this.canvas.style.width = container.clientWidth + 'px';
        this.canvas.style.height = container.clientHeight + 'px';
        this.ctx.scale(dpr, dpr);
    }
    
    loadBoardPieces(boardData) {
        this.pieces.clear();
        boardData.forEach(piece => {
            const key = `${piece.x},${piece.y}`;
            this.pieces.set(key, piece);
        });
        console.log(`Loaded ${this.pieces.size} pieces`);
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        // Window resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.render();
        });
        
        // Prevent context menu on right click
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    setupBoardUpdates() {
        // Request visible board section every few seconds
        setInterval(() => {
            this.requestVisibleBoardSection();
        }, 3000);
    }
    
    requestVisibleBoardSection() {
        const bounds = this.getVisibleBounds();
        this.socket.emit('get-board-section', bounds);
    }
    
    getVisibleBounds() {
        const margin = 10; // Extra cells around visible area
        const minX = Math.floor((0 - this.offsetX) / (this.cellSize * this.zoom)) - margin;
        const maxX = Math.ceil((this.canvas.width - this.offsetX) / (this.cellSize * this.zoom)) + margin;
        const minY = Math.floor((0 - this.offsetY) / (this.cellSize * this.zoom)) - margin;
        const maxY = Math.ceil((this.canvas.height - this.offsetY) / (this.cellSize * this.zoom)) + margin;
        
        return { minX, maxX, minY, maxY };
    }
    
    updateBoardSection(data) {
        // Update pieces in the received section
        data.pieces.forEach(piece => {
            const key = `${piece.x},${piece.y}`;
            this.pieces.set(key, piece);
        });
        this.render();
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.lastMouseX = x;
        this.lastMouseY = y;
        
        const boardPos = this.screenToBoard(x, y);
        const piece = this.getPieceAt(boardPos.x, boardPos.y);
        
        if (e.button === 0) { // Left click
            if (this.isOnCooldown) {
                // Show cooldown message if trying to interact during cooldown
                const remainingSeconds = Math.ceil(this.getRemainingCooldownMs() / 1000);
                if (window.chess2App) {
                    window.chess2App.showToast(`Wait ${remainingSeconds} seconds before making another move`, 'warning');
                }
            } else if (piece && piece.playerId === this.player.id) {
                // Check if this specific piece is duplicating
                const pieceKey = `${boardPos.x},${boardPos.y}`;
                const isPieceDuplicating = this.duplicatingPawns.has(pieceKey);
                
                if (isPieceDuplicating) {
                    // Show duplication message for this specific pawn
                    const duplicationData = this.duplicatingPawns.get(pieceKey);
                    const remainingSeconds = Math.ceil((duplicationData.endTime - Date.now()) / 1000);
                    if (window.chess2App) {
                        window.chess2App.showToast(`This pawn is duplicating: ${Math.max(0, remainingSeconds)}s remaining`, 'warning');
                    }
                } else {
                    // Select own piece (only if not duplicating)
                    this.selectPiece(piece, boardPos.x, boardPos.y);
                }
            } else if (piece && piece.playerId !== this.player.id) {
                // Clicked on enemy piece - hide pawn actions but don't select
                this.hidePawnActions();
            } else if (this.selectedPiece) {
                // Try to move selected piece
                this.tryMovePiece(boardPos.x, boardPos.y);
            } else {
                // Clicked on empty space or enemy piece - hide pawn actions and start dragging
                this.hidePawnActions();
                this.isDragging = true;
                this.dragStartX = x;
                this.dragStartY = y;
            }
        } else if (e.button === 2) { // Right click
            this.deselectPiece();
        }
        
        e.preventDefault();
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.isDragging) {
            const deltaX = x - this.lastMouseX;
            const deltaY = y - this.lastMouseY;
            
            this.offsetX += deltaX;
            this.offsetY += deltaY;
            
            this.render();
        }
        
        this.lastMouseX = x;
        this.lastMouseY = y;
        
        // Update coordinates display
        const boardPos = this.screenToBoard(x, y);
        document.getElementById('current-coords').textContent = 
            `(${boardPos.x}, ${boardPos.y})`;
    }
    
    handleMouseUp(e) {
        this.isDragging = false;
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));
        
        if (newZoom !== this.zoom) {
            // Zoom towards mouse position
            const worldX = (mouseX - this.offsetX) / this.zoom;
            const worldY = (mouseY - this.offsetY) / this.zoom;
            
            this.zoom = newZoom;
            
            this.offsetX = mouseX - worldX * this.zoom;
            this.offsetY = mouseY - worldY * this.zoom;
            
            this.render();
        }
    }
    
    // Touch event handlers
    handleTouchStart(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.handleMouseDown({
                clientX: touch.clientX,
                clientY: touch.clientY,
                button: 0,
                preventDefault: () => e.preventDefault()
            });
        }
    }
    
    handleTouchMove(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.handleMouseMove({
                clientX: touch.clientX,
                clientY: touch.clientY
            });
        }
        e.preventDefault();
    }
    
    handleTouchEnd(e) {
        this.handleMouseUp(e);
    }
    
    screenToBoard(screenX, screenY) {
        const worldX = (screenX - this.offsetX) / (this.cellSize * this.zoom);
        const worldY = (screenY - this.offsetY) / (this.cellSize * this.zoom);
        
        return {
            x: Math.floor(worldX),
            y: Math.floor(worldY)
        };
    }
    
    boardToScreen(boardX, boardY) {
        return {
            x: boardX * this.cellSize * this.zoom + this.offsetX,
            y: boardY * this.cellSize * this.zoom + this.offsetY
        };
    }
    
    getPieceAt(x, y) {
        const key = `${x},${y}`;
        return this.pieces.get(key);
    }
    
    selectPiece(piece, x, y) {
        this.selectedPiece = { piece, x, y };
        this.calculateValidMoves(piece, x, y);
        
        // Always hide pawn actions first
        this.hidePawnActions();
        
        // Show pawn duplication UI ONLY if a pawn is selected and conditions are met
        if (piece.type === 'pawn' && !this.isOnCooldown) {
            const pawnKey = `${x},${y}`;
            const isPawnDuplicating = this.duplicatingPawns.has(pawnKey);
            
            if (!isPawnDuplicating) {
                this.showPawnActions(piece, x, y);
            }
        }
        
        this.render();
    }
    
    deselectPiece() {
        this.selectedPiece = null;
        this.validMoves = [];
        this.hidePawnActions();
        this.render();
    }
    
    calculateValidMoves(piece, x, y) {
        // Basic movement calculation (simplified for demo)
        this.validMoves = [];
        
        // For now, allow moves to adjacent empty squares
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                
                const newX = x + dx;
                const newY = y + dy;
                
                if (!this.getPieceAt(newX, newY)) {
                    this.validMoves.push({ x: newX, y: newY });
                }
            }
        }
        
        // Add piece-specific moves based on type
        switch (piece.type) {
            case 'rook':
                this.addLinearMoves(x, y, [[1,0], [-1,0], [0,1], [0,-1]]);
                break;
            case 'bishop':
                this.addLinearMoves(x, y, [[1,1], [-1,1], [1,-1], [-1,-1]]);
                break;
            case 'queen':
                this.addLinearMoves(x, y, [[1,0], [-1,0], [0,1], [0,-1], [1,1], [-1,1], [1,-1], [-1,-1]]);
                break;
            case 'knight':
                this.addKnightMoves(x, y);
                break;
        }
    }
    
    addLinearMoves(x, y, directions) {
        directions.forEach(([dx, dy]) => {
            for (let i = 1; i <= 7; i++) { // Max 7 squares in any direction
                const newX = x + dx * i;
                const newY = y + dy * i;
                const piece = this.getPieceAt(newX, newY);
                
                if (!piece) {
                    this.validMoves.push({ x: newX, y: newY });
                } else {
                    // Can capture opponent piece
                    if (piece.playerId !== this.player.id) {
                        this.validMoves.push({ x: newX, y: newY });
                    }
                    break; // Can't move past any piece
                }
            }
        });
    }
    
    addKnightMoves(x, y) {
        const knightMoves = [
            [2, 1], [2, -1], [-2, 1], [-2, -1],
            [1, 2], [1, -2], [-1, 2], [-1, -2]
        ];
        
        knightMoves.forEach(([dx, dy]) => {
            const newX = x + dx;
            const newY = y + dy;
            const piece = this.getPieceAt(newX, newY);
            
            if (!piece || piece.playerId !== this.player.id) {
                this.validMoves.push({ x: newX, y: newY });
            }
        });
    }
    
    tryMovePiece(toX, toY) {
        if (!this.selectedPiece) return;
        
        // Check if move is valid
        const isValidMove = this.validMoves.some(move => move.x === toX && move.y === toY);
        
        if (isValidMove) {
            const { x: fromX, y: fromY } = this.selectedPiece;
            
            // Send move to server
            this.socket.emit('move-piece', {
                fromX, fromY, toX, toY
            });
            
            this.deselectPiece();
        }
    }
    
    handlePieceMoved(moveData) {
        const { fromX, fromY, toX, toY, piece, playerId } = moveData;
        
        // Remove piece from old position
        const fromKey = `${fromX},${fromY}`;
        this.pieces.delete(fromKey);
        
        // Add piece to new position
        const toKey = `${toX},${toY}`;
        this.pieces.set(toKey, piece);
        
        // If it's our move, start cooldown
        if (playerId === this.player.id) {
            this.startCooldown(3000); // 3 second cooldown
        }
        
        this.render();
    }
    
    startCooldown(durationMs) {
        this.isOnCooldown = true;
        this.cooldownEndTime = Date.now() + durationMs;
        
        // Deselect any selected piece during cooldown
        this.deselectPiece();
        
        // Clear any existing timer
        if (this.cooldownTimer) {
            clearTimeout(this.cooldownTimer);
        }
        
        // Set timer to end cooldown
        this.cooldownTimer = setTimeout(() => {
            this.isOnCooldown = false;
            this.cooldownEndTime = 0;
            this.render(); // Re-render to remove cooldown visuals
        }, durationMs);
        
        this.render();
    }
    
    getRemainingCooldownMs() {
        if (!this.isOnCooldown) return 0;
        return Math.max(0, this.cooldownEndTime - Date.now());
    }
    
    cleanup() {
        // Clean up cooldown timer
        if (this.cooldownTimer) {
            clearTimeout(this.cooldownTimer);
            this.cooldownTimer = null;
        }
        this.isOnCooldown = false;
        this.cooldownEndTime = 0;
        
        // Clean up all duplication timers
        this.duplicatingPawns.forEach((duplicationData, pawnKey) => {
            if (duplicationData.timer) {
                clearTimeout(duplicationData.timer);
            }
        });
        this.duplicatingPawns.clear();
        this.selectedPawnForDuplication = null;
        this.hidePawnActions();
    }
    
    showPawnActions(piece, x, y) {
        const pawnActionsDiv = document.getElementById('pawn-actions');
        if (pawnActionsDiv) {
            pawnActionsDiv.classList.remove('hidden');
            this.selectedPawnForDuplication = { piece, x, y };
            
            // Always reset button to fresh state when showing
            this.resetDuplicationUI();
            
            // Setup event listener for duplicate button
            const duplicateBtn = document.getElementById('duplicate-pawn-btn');
            if (duplicateBtn) {
                // Remove existing listener
                duplicateBtn.replaceWith(duplicateBtn.cloneNode(true));
                const newBtn = document.getElementById('duplicate-pawn-btn');
                
                newBtn.addEventListener('click', () => this.startPawnDuplication());
            }
        }
    }
    
    hidePawnActions() {
        const pawnActionsDiv = document.getElementById('pawn-actions');
        if (pawnActionsDiv) {
            pawnActionsDiv.classList.add('hidden');
        }
        
        // Only reset button state if no pawns are currently duplicating
        if (this.duplicatingPawns.size === 0) {
            this.resetDuplicationUI();
        }
        
        this.selectedPawnForDuplication = null;
    }
    
    startPawnDuplication() {
        if (!this.selectedPawnForDuplication || this.isOnCooldown) {
            return;
        }
        
        const { x, y, piece } = this.selectedPawnForDuplication;
        const pawnKey = `${x},${y}`;
        
        // Check if this pawn is already duplicating
        if (this.duplicatingPawns.has(pawnKey)) {
            return;
        }
        
        // Find available adjacent tiles
        const adjacentTiles = this.getAdjacentEmptyTiles(x, y);
        
        if (adjacentTiles.length === 0) {
            window.chess2App.showToast('No adjacent empty tiles available for duplication', 'warning');
            return;
        }
        
        // Start duplication process for this specific pawn
        const duplicationData = {
            endTime: Date.now() + 15000,
            adjacentTiles: adjacentTiles,
            pawnData: { piece, x, y },
            timer: null
        };
        
        this.duplicatingPawns.set(pawnKey, duplicationData);
        
        // Disable the duplicate button and show progress
        const duplicateBtn = document.getElementById('duplicate-pawn-btn');
        const progressDiv = document.getElementById('duplication-progress');
        
        if (duplicateBtn) {
            duplicateBtn.disabled = true;
            duplicateBtn.textContent = 'Duplicating...';
        }
        
        if (progressDiv) {
            progressDiv.classList.remove('hidden');
        }
        
        // Start progress animation
        this.updateDuplicationProgress(pawnKey);
        
        // Set timer to complete duplication
        duplicationData.timer = setTimeout(() => {
            this.completePawnDuplication(pawnKey);
        }, 15000);
        
        // Hide the pawn actions panel after starting duplication
        this.hidePawnActions();
        
        this.render();
        window.chess2App.showToast('Pawn duplication started (15 seconds)', 'info');
    }
    
    getAdjacentEmptyTiles(x, y) {
        const adjacentTiles = [];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        
        directions.forEach(([dx, dy]) => {
            const newX = x + dx;
            const newY = y + dy;
            
            if (!this.getPieceAt(newX, newY)) {
                adjacentTiles.push({ x: newX, y: newY });
            }
        });
        
        return adjacentTiles;
    }
    
    updateDuplicationProgress(pawnKey) {
        const duplicationData = this.duplicatingPawns.get(pawnKey);
        if (!duplicationData) return;
        
        const remainingTime = duplicationData.endTime - Date.now();
        const progress = Math.max(0, (15000 - remainingTime) / 15000 * 100);
        const seconds = Math.ceil(remainingTime / 1000);
        
        const progressFill = document.getElementById('duplication-progress-fill');
        const timerSpan = document.getElementById('duplication-timer');
        
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        
        if (timerSpan) {
            timerSpan.textContent = `${Math.max(0, seconds)}s`;
        }
        
        if (remainingTime > 0 && this.duplicatingPawns.has(pawnKey)) {
            setTimeout(() => this.updateDuplicationProgress(pawnKey), 100);
        }
    }
    
    completePawnDuplication(pawnKey) {
        const duplicationData = this.duplicatingPawns.get(pawnKey);
        if (!duplicationData || duplicationData.adjacentTiles.length === 0) {
            this.cancelPawnDuplication(pawnKey);
            return;
        }
        
        // Choose a random adjacent tile
        const targetTile = duplicationData.adjacentTiles[Math.floor(Math.random() * duplicationData.adjacentTiles.length)];
        const { piece, x: fromX, y: fromY } = duplicationData.pawnData;
        
        // Send duplication request to server
        this.socket.emit('duplicate-pawn', {
            fromX,
            fromY,
            toX: targetTile.x,
            toY: targetTile.y
        });
        
        // Remove this pawn from duplicating state
        this.duplicatingPawns.delete(pawnKey);
        
        // Reset the UI elements
        this.resetDuplicationUI();
        
        // Start normal cooldown
        this.startCooldown(3000);
        
        window.chess2App.showToast('Pawn duplication completed!', 'success');
    }
    
    resetDuplicationUI() {
        const duplicateBtn = document.getElementById('duplicate-pawn-btn');
        const progressDiv = document.getElementById('duplication-progress');
        
        if (duplicateBtn) {
            duplicateBtn.disabled = false;
            duplicateBtn.textContent = '🐣 Duplicate';
        }
        
        if (progressDiv) {
            progressDiv.classList.add('hidden');
        }
    }
    
    cancelPawnDuplication(pawnKey) {
        const duplicationData = this.duplicatingPawns.get(pawnKey);
        if (duplicationData) {
            if (duplicationData.timer) {
                clearTimeout(duplicationData.timer);
            }
            this.duplicatingPawns.delete(pawnKey);
        }
        
        // Reset UI if no pawns are duplicating
        if (this.duplicatingPawns.size === 0) {
            this.resetDuplicationUI();
        }
        
        this.render();
    }
    
    handlePawnDuplicated(data) {
        const { originalPiece, duplicatedPiece } = data;
        
        // Add the duplicated piece to the board
        const duplicateKey = `${duplicatedPiece.x},${duplicatedPiece.y}`;
        this.pieces.set(duplicateKey, duplicatedPiece);
        
        this.render();
    }
    
    centerOnPlayerPieces() {
        // Find player's pieces
        const playerPieces = Array.from(this.pieces.values())
            .filter(piece => piece.playerId === this.player.id);
        
        if (playerPieces.length === 0) return;
        
        // Calculate center of player's pieces
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        playerPieces.forEach(piece => {
            minX = Math.min(minX, piece.x);
            maxX = Math.max(maxX, piece.x);
            minY = Math.min(minY, piece.y);
            maxY = Math.max(maxY, piece.y);
        });
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // Center view on pieces
        this.offsetX = this.canvas.width / 2 - centerX * this.cellSize * this.zoom;
        this.offsetY = this.canvas.height / 2 - centerY * this.cellSize * this.zoom;
        
        this.render();
    }
    
    zoomIn() {
        this.zoom = Math.min(this.maxZoom, this.zoom * 1.2);
        this.render();
    }
    
    zoomOut() {
        this.zoom = Math.max(this.minZoom, this.zoom / 1.2);
        this.render();
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.drawGrid();
        
        // Draw pieces
        this.drawPieces();
        
        // Draw selection and valid moves (only if not on cooldown)
        if (this.selectedPiece && !this.isOnCooldown) {
            this.drawSelection();
            this.drawValidMoves();
        }
        
        // Draw cooldown overlay if active
        if (this.isOnCooldown) {
            this.drawCooldownOverlay();
        }
        
        // Draw duplication indicators for individual pawns
        this.drawDuplicatingPawns();
    }
    
    drawGrid() {
        const bounds = this.getVisibleBounds();
        
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        
        // Draw vertical lines
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            const screenX = this.boardToScreen(x, 0).x;
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, 0);
            this.ctx.lineTo(screenX, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            const screenY = this.boardToScreen(0, y).y;
            this.ctx.beginPath();
            this.ctx.moveTo(0, screenY);
            this.ctx.lineTo(this.canvas.width, screenY);
            this.ctx.stroke();
        }
        
        // Highlight origin
        const origin = this.boardToScreen(0, 0);
        const cellSize = this.cellSize * this.zoom;
        
        if (origin.x >= -cellSize && origin.x <= this.canvas.width &&
            origin.y >= -cellSize && origin.y <= this.canvas.height) {
            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
            this.ctx.fillRect(origin.x, origin.y, cellSize, cellSize);
        }
    }
    
    drawPieces() {
        const bounds = this.getVisibleBounds();
        const cellSize = this.cellSize * this.zoom;
        
        this.ctx.font = `${Math.max(12, cellSize * 0.7)}px serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        this.pieces.forEach((piece) => {
            if (piece.x >= bounds.minX && piece.x <= bounds.maxX &&
                piece.y >= bounds.minY && piece.y <= bounds.maxY) {
                
                const pos = this.boardToScreen(piece.x, piece.y);
                const centerX = pos.x + cellSize / 2;
                const centerY = pos.y + cellSize / 2;
                
                // Draw piece background
                this.ctx.fillStyle = piece.color;
                this.ctx.fillRect(pos.x + 2, pos.y + 2, cellSize - 4, cellSize - 4);
                
                // Draw piece symbol
                this.ctx.fillStyle = '#000';
                this.ctx.fillText(this.pieceSymbols[piece.type] || '?', centerX, centerY);
            }
        });
    }
    
    drawSelection() {
        const { x, y } = this.selectedPiece;
        const pos = this.boardToScreen(x, y);
        const cellSize = this.cellSize * this.zoom;
        
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(pos.x, pos.y, cellSize, cellSize);
    }
    
    drawValidMoves() {
        const cellSize = this.cellSize * this.zoom;
        
        this.ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        
        this.validMoves.forEach(move => {
            const pos = this.boardToScreen(move.x, move.y);
            this.ctx.fillRect(pos.x, pos.y, cellSize, cellSize);
        });
    }
    
    drawCooldownOverlay() {
        // Draw semi-transparent overlay
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw cooldown message
        const remainingSeconds = Math.ceil(this.getRemainingCooldownMs() / 1000);
        const message = `Cooldown: ${remainingSeconds}s`;
        
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Draw background for text
        const textWidth = this.ctx.measureText(message).width;
        const padding = 20;
        const bgWidth = textWidth + padding * 2;
        const bgHeight = 40;
        const bgX = (this.canvas.width - bgWidth) / 2;
        const bgY = 50;
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
        
        // Draw text
        this.ctx.fillStyle = '#ff0000';
        this.ctx.fillText(message, this.canvas.width / 2, bgY + bgHeight / 2);
        
        this.ctx.restore();
        
        // Schedule a re-render to update the countdown
        if (this.isOnCooldown) {
            setTimeout(() => {
                if (this.isOnCooldown) {
                    this.render();
                }
            }, 100); // Update every 100ms for smooth countdown
        }
    }
    
    drawDuplicatingPawns() {
        if (this.duplicatingPawns.size === 0) return;
        
        const bounds = this.getVisibleBounds();
        const cellSize = this.cellSize * this.zoom;
        
        this.duplicatingPawns.forEach((duplicationData, pawnKey) => {
            const [x, y] = pawnKey.split(',').map(Number);
            
            // Only draw if pawn is visible
            if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
                const pos = this.boardToScreen(x, y);
                
                // Draw golden pulsing border around duplicating pawn
                const time = Date.now() / 500;
                const alpha = 0.5 + 0.3 * Math.sin(time);
                
                this.ctx.save();
                this.ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
                this.ctx.lineWidth = 4;
                this.ctx.strokeRect(pos.x - 2, pos.y - 2, cellSize + 4, cellSize + 4);
                
                // Draw progress indicator
                const remainingTime = duplicationData.endTime - Date.now();
                const progress = Math.max(0, (15000 - remainingTime) / 15000);
                
                // Draw progress bar above the pawn
                const barWidth = cellSize * 0.8;
                const barHeight = 4;
                const barX = pos.x + (cellSize - barWidth) / 2;
                const barY = pos.y - 8;
                
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                this.ctx.fillRect(barX, barY, barWidth, barHeight);
                
                this.ctx.fillStyle = '#ffd700';
                this.ctx.fillRect(barX, barY, barWidth * progress, barHeight);
                
                // Draw remaining time text
                const remainingSeconds = Math.ceil(remainingTime / 1000);
                if (remainingSeconds > 0) {
                    this.ctx.fillStyle = '#ffd700';
                    this.ctx.font = 'bold 12px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'bottom';
                    this.ctx.fillText(`${remainingSeconds}s`, pos.x + cellSize / 2, barY - 2);
                }
                
                this.ctx.restore();
            }
        });
        
        // Schedule a re-render to update the visual indicators
        if (this.duplicatingPawns.size > 0) {
            setTimeout(() => {
                if (this.duplicatingPawns.size > 0) {
                    this.render();
                }
            }, 100);
        }
    }
}
