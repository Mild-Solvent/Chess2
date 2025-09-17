const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 100;

// Game state
const gameState = {
    players: new Map(),
    board: new Map(), // Infinite board using coordinate strings as keys
    playerColors: [],
    nextPlayerIndex: 0
};

// Chess piece colors for up to 100 players
const PLAYER_COLORS = [
    '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
    '#800000', '#008000', '#000080', '#808000', '#800080', '#008080',
    '#FFA500', '#FFC0CB', '#A52A2A', '#D2691E', '#FF1493', '#00CED1',
    '#32CD32', '#FFD700', '#DC143C', '#00FA9A', '#1E90FF', '#FF69B4'
];

// Expand colors array to 100 unique colors
for (let i = PLAYER_COLORS.length; i < 100; i++) {
    const hue = (i * 137.508) % 360; // Golden angle approximation for good color distribution
    PLAYER_COLORS.push(`hsl(${Math.floor(hue)}, 70%, 50%)`);
}

// Serve static files
app.use(express.static('public'));

// Initialize empty board
function initializeBoard() {
    // Board starts empty - pieces are spawned when players join
    console.log('Initialized empty board');
}

// Find a spawn position that's at least SPAWN_DISTANCE from any existing player
function findSpawnPosition(minDistance = 25) {
    const existingPositions = [];
    
    // Get positions of all existing player pieces
    for (const [key, piece] of gameState.board) {
        if (piece.playerId) {
            const [x, y] = key.split(',').map(Number);
            existingPositions.push({ x, y });
        }
    }
    
    // If no players exist, spawn at origin
    if (existingPositions.length === 0) {
        return { x: 0, y: 0 };
    }
    
    // Find a valid position using spiral search
    let angle = 0;
    let radius = minDistance;
    let attempts = 0;
    const maxAttempts = 10000;
    
    while (attempts < maxAttempts) {
        const x = Math.round(radius * Math.cos(angle));
        const y = Math.round(radius * Math.sin(angle));
        
        // Check distance from all existing positions
        const validPosition = existingPositions.every(pos => {
            const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
            return dist >= minDistance;
        });
        
        if (validPosition) {
            return { x, y };
        }
        
        // Move to next spiral position
        angle += Math.PI / 8; // Smaller angle steps for better coverage
        if (angle > Math.PI * 2) {
            angle = 0;
            radius += Math.min(5, minDistance / 4); // Gradually increase radius
        }
        
        attempts++;
    }
    
    // Fallback: find the furthest position from all existing pieces
    let bestPosition = { x: 0, y: 0 };
    let maxMinDistance = 0;
    
    for (let testRadius = minDistance; testRadius < minDistance * 3; testRadius += 5) {
        for (let testAngle = 0; testAngle < Math.PI * 2; testAngle += Math.PI / 4) {
            const x = Math.round(testRadius * Math.cos(testAngle));
            const y = Math.round(testRadius * Math.sin(testAngle));
            
            const minDistanceToExisting = Math.min(...existingPositions.map(pos => {
                return Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
            }));
            
            if (minDistanceToExisting > maxMinDistance) {
                maxMinDistance = minDistanceToExisting;
                bestPosition = { x, y };
            }
        }
    }
    
    console.log(`Spawn position found: (${bestPosition.x}, ${bestPosition.y}) with min distance ${maxMinDistance}`);
    return bestPosition;
}

// Spawn pieces for a new player
function spawnPlayerPieces(playerId, playerColor) {
    const spawnPos = findSpawnPosition(25);
    const { x, y } = spawnPos;
    
    const pieces = [
        // Back row
        { type: 'rook', x: x - 3, y: y, color: playerColor, playerId: playerId },
        { type: 'knight', x: x - 2, y: y, color: playerColor, playerId: playerId },
        { type: 'bishop', x: x - 1, y: y, color: playerColor, playerId: playerId },
        { type: 'queen', x: x, y: y, color: playerColor, playerId: playerId },
        { type: 'king', x: x + 1, y: y, color: playerColor, playerId: playerId },
        { type: 'bishop', x: x + 2, y: y, color: playerColor, playerId: playerId },
        { type: 'knight', x: x + 3, y: y, color: playerColor, playerId: playerId },
        { type: 'rook', x: x + 4, y: y, color: playerColor, playerId: playerId },
        // Front row (pawns)
        { type: 'pawn', x: x - 3, y: y + 1, color: playerColor, playerId: playerId },
        { type: 'pawn', x: x - 2, y: y + 1, color: playerColor, playerId: playerId },
        { type: 'pawn', x: x - 1, y: y + 1, color: playerColor, playerId: playerId },
        { type: 'pawn', x: x, y: y + 1, color: playerColor, playerId: playerId },
        { type: 'pawn', x: x + 1, y: y + 1, color: playerColor, playerId: playerId },
        { type: 'pawn', x: x + 2, y: y + 1, color: playerColor, playerId: playerId },
        { type: 'pawn', x: x + 3, y: y + 1, color: playerColor, playerId: playerId },
        { type: 'pawn', x: x + 4, y: y + 1, color: playerColor, playerId: playerId }
    ];
    
    // Add pieces to board
    pieces.forEach(piece => {
        const key = `${piece.x},${piece.y}`;
        gameState.board.set(key, piece);
    });
    
    console.log(`Spawned pieces for player at (${x}, ${y})`);
    return pieces;
}

// Initialize the board
initializeBoard();

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Handle player join
    socket.on('join-game', (playerName) => {
        if (gameState.players.size >= MAX_PLAYERS) {
            socket.emit('game-full');
            return;
        }

        const playerId = uuidv4();
        const playerColor = PLAYER_COLORS[gameState.nextPlayerIndex % PLAYER_COLORS.length];
        
        const player = {
            id: playerId,
            socketId: socket.id,
            name: playerName || `Player${gameState.players.size + 1}`,
            color: playerColor,
            colorIndex: gameState.nextPlayerIndex,
            isActive: true,
            joinedAt: Date.now()
        };

        gameState.players.set(playerId, player);
        gameState.nextPlayerIndex++;
        
        // Spawn pieces for this new player
        const newPieces = spawnPlayerPieces(playerId, playerColor);

        socket.playerId = playerId;
        
        // Send initial game state to the new player
        // Only include pieces from active players
        const activePlayerIds = Array.from(gameState.players.keys());
        const activePieces = Array.from(gameState.board.entries())
            .filter(([key, piece]) => piece.playerId && activePlayerIds.includes(piece.playerId))
            .map(([key, piece]) => {
                const [x, y] = key.split(',').map(Number);
                return { ...piece, x, y };
            });
        
        socket.emit('game-joined', {
            playerId: playerId,
            player: player,
            board: activePieces,
            players: Array.from(gameState.players.values())
        });

        // Notify all other players
        socket.broadcast.emit('player-joined', player);
        
        console.log(`Player ${player.name} joined with color ${playerColor}`);
    });

    // Handle piece movement
    socket.on('move-piece', (moveData) => {
        const player = gameState.players.get(socket.playerId);
        if (!player) return;

        const { fromX, fromY, toX, toY } = moveData;
        const fromKey = `${fromX},${fromY}`;
        const toKey = `${toX},${toY}`;
        
        const piece = gameState.board.get(fromKey);
        
        // Validate move (basic validation - piece belongs to player)
        if (!piece || piece.playerId !== player.id) {
            socket.emit('invalid-move', 'Not your piece');
            return;
        }

        // Move piece
        gameState.board.delete(fromKey);
        piece.x = toX;
        piece.y = toY;
        gameState.board.set(toKey, piece);

        // Broadcast move to all players
        io.emit('piece-moved', {
            playerId: player.id,
            fromX, fromY, toX, toY,
            piece: piece
        });
        
        console.log(`${player.name} moved ${piece.type} from (${fromX},${fromY}) to (${toX},${toY})`);
    });

    // Handle getting board section
    socket.on('get-board-section', (bounds) => {
        const { minX, maxX, minY, maxY } = bounds;
        const pieces = [];
        
        // Get list of active player IDs
        const activePlayerIds = Array.from(gameState.players.keys());
        
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const key = `${x},${y}`;
                const piece = gameState.board.get(key);
                if (piece && piece.playerId && activePlayerIds.includes(piece.playerId)) {
                    pieces.push({ ...piece, x, y });
                }
            }
        }
        
        socket.emit('board-section', { bounds, pieces });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const player = gameState.players.get(socket.playerId);
        if (player) {
            // Mark player as inactive but keep them in the players map for potential reconnection
            player.isActive = false;
            player.disconnectedAt = Date.now();
            
            // Remove from active players map
            gameState.players.delete(socket.playerId);
            
            // Notify other players
            socket.broadcast.emit('player-left', socket.playerId);
            
            console.log(`Player ${player.name} disconnected`);
            
            // Note: We keep the player's pieces on the board for potential reconnection
            // A cleanup mechanism could be added later to remove pieces from players
            // who have been disconnected for an extended period (e.g., 30 minutes)
        }
        console.log('Client disconnected:', socket.id);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Chess 2 server running on port ${PORT}`);
    console.log(`Access the game at: http://localhost:${PORT}`);
    console.log(`Max players: ${MAX_PLAYERS}`);
});
