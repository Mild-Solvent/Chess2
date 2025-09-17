// Core game logic and chess rules
class ChessGame {
    constructor() {
        // Game state
        this.currentTurn = null;
        this.gamePhase = 'waiting'; // waiting, playing, ended
        this.moveHistory = [];
        this.capturedPieces = [];
        
        // Game rules configuration
        this.rules = {
            allowMultiplayerMovement: true, // Players can move simultaneously
            captureEnabled: true,
            kingRequired: false, // In infinite chess, king capture doesn't end game
            maxMovesPerTurn: 1,
            turnTimeLimit: null // No time limit for now
        };
    }
    
    // Validate move according to chess rules
    static validateMove(piece, fromX, fromY, toX, toY, boardState) {
        if (!piece) return false;
        
        const dx = toX - fromX;
        const dy = toY - fromY;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        
        // Check basic movement patterns
        switch (piece.type) {
            case 'pawn':
                return ChessGame.validatePawnMove(piece, dx, dy, boardState, fromX, fromY);
            case 'rook':
                return ChessGame.validateRookMove(dx, dy, boardState, fromX, fromY, toX, toY);
            case 'knight':
                return ChessGame.validateKnightMove(adx, ady);
            case 'bishop':
                return ChessGame.validateBishopMove(dx, dy, boardState, fromX, fromY, toX, toY);
            case 'queen':
                return ChessGame.validateQueenMove(dx, dy, boardState, fromX, fromY, toX, toY);
            case 'king':
                return ChessGame.validateKingMove(adx, ady);
            default:
                return false;
        }
    }
    
    static validatePawnMove(piece, dx, dy, boardState, fromX, fromY) {
        // Simplified pawn movement (assuming forward is +Y direction)
        // In infinite chess, we don't have a fixed "forward" direction per player
        // So we allow pawns to move in any cardinal direction
        
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        
        // Pawn can move one square in cardinal directions
        if ((adx === 1 && ady === 0) || (adx === 0 && ady === 1)) {
            const targetKey = `${fromX + dx},${fromY + dy}`;
            const targetPiece = boardState.get(targetKey);
            
            // Can move to empty square or capture opponent piece
            return !targetPiece || targetPiece.playerId !== piece.playerId;
        }
        
        return false;
    }
    
    static validateRookMove(dx, dy, boardState, fromX, fromY, toX, toY) {
        // Rook moves horizontally or vertically
        if (dx !== 0 && dy !== 0) return false;
        
        return ChessGame.validateLinearMove(dx, dy, boardState, fromX, fromY, toX, toY);
    }
    
    static validateKnightMove(adx, ady) {
        // Knight moves in L-shape
        return (adx === 2 && ady === 1) || (adx === 1 && ady === 2);
    }
    
    static validateBishopMove(dx, dy, boardState, fromX, fromY, toX, toY) {
        // Bishop moves diagonally
        if (Math.abs(dx) !== Math.abs(dy)) return false;
        
        return ChessGame.validateLinearMove(dx, dy, boardState, fromX, fromY, toX, toY);
    }
    
    static validateQueenMove(dx, dy, boardState, fromX, fromY, toX, toY) {
        // Queen combines rook and bishop moves
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        
        // Must be horizontal, vertical, or diagonal
        if (dx !== 0 && dy !== 0 && adx !== ady) return false;
        
        return ChessGame.validateLinearMove(dx, dy, boardState, fromX, fromY, toX, toY);
    }
    
    static validateKingMove(adx, ady) {
        // King moves one square in any direction
        return adx <= 1 && ady <= 1 && (adx + ady > 0);
    }
    
    static validateLinearMove(dx, dy, boardState, fromX, fromY, toX, toY) {
        // Check if path is clear for linear moves (rook, bishop, queen)
        const stepX = dx === 0 ? 0 : dx / Math.abs(dx);
        const stepY = dy === 0 ? 0 : dy / Math.abs(dy);
        
        let currentX = fromX + stepX;
        let currentY = fromY + stepY;
        
        // Check each square along the path (excluding destination)
        while (currentX !== toX || currentY !== toY) {
            const key = `${currentX},${currentY}`;
            if (boardState.has(key)) {
                return false; // Path blocked
            }
            currentX += stepX;
            currentY += stepY;
        }
        
        // Check destination square
        const targetKey = `${toX},${toY}`;
        const targetPiece = boardState.get(targetKey);
        const movingPiece = boardState.get(`${fromX},${fromY}`);
        
        // Can move to empty square or capture opponent piece
        return !targetPiece || targetPiece.playerId !== movingPiece.playerId;
    }
    
    // Check if move puts own king in check (simplified for infinite chess)
    static wouldExposeKing(move, boardState, playerId) {
        // In infinite chess with multiple players, this is simplified
        // We'll skip complex king safety checks for now
        return false;
    }
    
    // Get all valid moves for a piece
    static getValidMoves(piece, x, y, boardState) {
        const validMoves = [];
        
        // Generate potential moves based on piece type
        const potentialMoves = ChessGame.generatePotentialMoves(piece, x, y);
        
        // Filter valid moves
        for (const move of potentialMoves) {
            if (ChessGame.validateMove(piece, x, y, move.x, move.y, boardState)) {
                validMoves.push(move);
            }
        }
        
        return validMoves;
    }
    
    static generatePotentialMoves(piece, x, y) {
        const moves = [];
        
        switch (piece.type) {
            case 'pawn':
                // Pawn can move in cardinal directions
                moves.push(
                    { x: x + 1, y: y },
                    { x: x - 1, y: y },
                    { x: x, y: y + 1 },
                    { x: x, y: y - 1 }
                );
                break;
                
            case 'rook':
                // Rook moves horizontally and vertically
                for (let i = 1; i <= 7; i++) {
                    moves.push(
                        { x: x + i, y: y },
                        { x: x - i, y: y },
                        { x: x, y: y + i },
                        { x: x, y: y - i }
                    );
                }
                break;
                
            case 'knight':
                // Knight moves in L-shape
                moves.push(
                    { x: x + 2, y: y + 1 }, { x: x + 2, y: y - 1 },
                    { x: x - 2, y: y + 1 }, { x: x - 2, y: y - 1 },
                    { x: x + 1, y: y + 2 }, { x: x + 1, y: y - 2 },
                    { x: x - 1, y: y + 2 }, { x: x - 1, y: y - 2 }
                );
                break;
                
            case 'bishop':
                // Bishop moves diagonally
                for (let i = 1; i <= 7; i++) {
                    moves.push(
                        { x: x + i, y: y + i },
                        { x: x + i, y: y - i },
                        { x: x - i, y: y + i },
                        { x: x - i, y: y - i }
                    );
                }
                break;
                
            case 'queen':
                // Queen combines rook and bishop
                for (let i = 1; i <= 7; i++) {
                    moves.push(
                        // Rook moves
                        { x: x + i, y: y },
                        { x: x - i, y: y },
                        { x: x, y: y + i },
                        { x: x, y: y - i },
                        // Bishop moves
                        { x: x + i, y: y + i },
                        { x: x + i, y: y - i },
                        { x: x - i, y: y + i },
                        { x: x - i, y: y - i }
                    );
                }
                break;
                
            case 'king':
                // King moves one square in any direction
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx !== 0 || dy !== 0) {
                            moves.push({ x: x + dx, y: y + dy });
                        }
                    }
                }
                break;
        }
        
        return moves;
    }
    
    // Calculate piece value for AI or scoring
    static getPieceValue(piece) {
        const values = {
            pawn: 1,
            knight: 3,
            bishop: 3,
            rook: 5,
            queen: 9,
            king: 1000 // High value but not infinite since king capture doesn't end game
        };
        
        return values[piece.type] || 0;
    }
    
    // Check if a square is under attack by opponent
    static isSquareUnderAttack(x, y, targetPlayerId, boardState) {
        for (const [key, piece] of boardState) {
            if (piece.playerId !== targetPlayerId) {
                const [pieceX, pieceY] = key.split(',').map(Number);
                if (ChessGame.validateMove(piece, pieceX, pieceY, x, y, boardState)) {
                    return true;
                }
            }
        }
        return false;
    }
    
    // Find all pieces of a specific type for a player
    static findPieces(boardState, playerId, pieceType = null) {
        const pieces = [];
        
        for (const [key, piece] of boardState) {
            if (piece.playerId === playerId) {
                if (!pieceType || piece.type === pieceType) {
                    const [x, y] = key.split(',').map(Number);
                    pieces.push({ piece, x, y });
                }
            }
        }
        
        return pieces;
    }
    
    // Calculate distance between two points
    static calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }
    
    // Check if position is within bounds (for infinite board, always true)
    static isValidPosition(x, y) {
        // In infinite chess, any integer position is valid
        return Number.isInteger(x) && Number.isInteger(y);
    }
    
    // Advanced move validation that considers game state
    static isMoveLegal(move, gameState) {
        const { fromX, fromY, toX, toY, playerId } = move;
        const fromKey = `${fromX},${fromY}`;
        const piece = gameState.board.get(fromKey);
        
        // Basic validations
        if (!piece) return { valid: false, reason: 'No piece at source position' };
        if (piece.playerId !== playerId) return { valid: false, reason: 'Not your piece' };
        if (!ChessGame.isValidPosition(toX, toY)) return { valid: false, reason: 'Invalid target position' };
        
        // Check piece movement rules
        if (!ChessGame.validateMove(piece, fromX, fromY, toX, toY, gameState.board)) {
            return { valid: false, reason: 'Invalid move for this piece' };
        }
        
        // Check if move would expose king (simplified)
        if (ChessGame.wouldExposeKing(move, gameState.board, playerId)) {
            return { valid: false, reason: 'Move would expose king' };
        }
        
        return { valid: true };
    }
}

// Export for use in other modules (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChessGame;
}
