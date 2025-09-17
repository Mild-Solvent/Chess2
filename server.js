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

// Initialize starting pieces with distance constraints
function initializeBoard() {
    const SPAWN_DISTANCE = 16; // Minimum distance between player starting positions
    const positions = [];
    
    // Generate spawn positions in a spiral pattern to ensure distance
    let angle = 0;
    let radius = 0;
    
    for (let playerIndex = 0; playerIndex < MAX_PLAYERS; playerIndex++) {
        let x, y;
        let validPosition = false;
        let attempts = 0;
        
        while (!validPosition && attempts < 1000) {
            // Spiral positioning
            x = Math.round(radius * Math.cos(angle));
            y = Math.round(radius * Math.sin(angle));
            
            // Check distance from all existing positions
            validPosition = positions.every(pos => {
                const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
                return dist >= SPAWN_DISTANCE;
            });
            
            if (validPosition) {
                positions.push({ x, y, playerIndex });
                
                // Place starting pieces for this player
                const color = PLAYER_COLORS[playerIndex];
                const pieces = [
                    // Back row
                    { type: 'rook', x: x - 3, y: y, color, playerId: null },
                    { type: 'knight', x: x - 2, y: y, color, playerId: null },
                    { type: 'bishop', x: x - 1, y: y, color, playerId: null },
                    { type: 'queen', x: x, y: y, color, playerId: null },
                    { type: 'king', x: x + 1, y: y, color, playerId: null },
                    { type: 'bishop', x: x + 2, y: y, color, playerId: null },
                    { type: 'knight', x: x + 3, y: y, color, playerId: null },
                    { type: 'rook', x: x + 4, y: y, color, playerId: null },
                    // Front row (pawns)
                    { type: 'pawn', x: x - 3, y: y + 1, color, playerId: null },
                    { type: 'pawn', x: x - 2, y: y + 1, color, playerId: null },
                    { type: 'pawn', x: x - 1, y: y + 1, color, playerId: null },
                    { type: 'pawn', x: x, y: y + 1, color, playerId: null },
                    { type: 'pawn', x: x + 1, y: y + 1, color, playerId: null },
                    { type: 'pawn', x: x + 2, y: y + 1, color, playerId: null },
                    { type: 'pawn', x: x + 3, y: y + 1, color, playerId: null },
                    { type: 'pawn', x: x + 4, y: y + 1, color, playerId: null }
                ];
                
                // Add pieces to board
                pieces.forEach(piece => {
                    const key = `${piece.x},${piece.y}`;
                    gameState.board.set(key, piece);
                });
            } else {
                // Move to next spiral position
                angle += 0.5;
                if (angle > Math.PI * 2) {
                    angle = 0;
                    radius += SPAWN_DISTANCE;
                }
            }
            attempts++;
        }
        
        if (!validPosition) {
            console.log(`Could not find valid position for player ${playerIndex}`);
            break;
        }
    }
    
    console.log(`Initialized board with ${positions.length} player positions`);
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
        
        // Assign pieces to this player
        for (const [key, piece] of gameState.board) {
            if (piece.color === playerColor && !piece.playerId) {
                piece.playerId = playerId;
            }
        }

        socket.playerId = playerId;
        
        // Send initial game state to the new player
        socket.emit('game-joined', {
            playerId: playerId,
            player: player,
            board: Array.from(gameState.board.entries()).map(([key, piece]) => {
                const [x, y] = key.split(',').map(Number);
                return { ...piece, x, y };
            }),
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
        
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const key = `${x},${y}`;
                const piece = gameState.board.get(key);
                if (piece) {
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
            player.isActive = false;
            gameState.players.delete(socket.playerId);
            
            // Notify other players
            socket.broadcast.emit('player-left', socket.playerId);
            
            console.log(`Player ${player.name} disconnected`);
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
