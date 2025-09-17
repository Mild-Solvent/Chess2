# Chess 2 - Infinite Multiplayer Chess

An infinite chess game that supports up to 100 players simultaneously. Players can move their pieces on an unlimited board where pieces spawn with tile distance between them.

## Features

- **Infinite Board**: Unlimited chess board that expands as needed
- **100 Player Support**: Up to 100 players can play simultaneously 
- **Real-time Multiplayer**: Socket.io powered real-time game updates
- **Cross-Platform**: Works on desktop and mobile browsers
- **Responsive UI**: Adapts to different screen sizes
- **Piece Movement**: Standard chess piece movement rules
- **Board Navigation**: Zoom, pan, and minimap for exploring the infinite board
- **Player Management**: Live player list with status indicators

## Quick Start

### Prerequisites

- **Node.js** (version 16 or higher)
- **npm** (comes with Node.js)

### Installation & Running

1. **Clone or download the repository**
2. **Navigate to the project directory**:
   ```bash
   cd Chess2
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Start the server**:
   ```bash
   npm start
   ```

5. **Open your browser** and go to:
   ```
   http://localhost:3000
   ```

6. **Share the link** with friends so they can join!

### Alternative Start Methods

**Development mode with auto-restart:**
```bash
npm run dev
```

**Direct node command:**
```bash
node server.js
```

**Using the startup script (Unix systems):**
```bash
./start.sh
```

## How to Play

### Joining the Game
1. Enter your name (or leave blank for auto-generated name)
2. Click "Join Game"
3. You'll be assigned a unique color and starting pieces

### Game Controls

**Desktop:**
- **Mouse Drag**: Pan around the board
- **Mouse Wheel**: Zoom in/out  
- **Left Click**: Select piece or move to square
- **Right Click**: Deselect piece
- **Space Bar**: Center view on your pieces
- **Ctrl/Cmd + Plus/Minus**: Zoom in/out

**Mobile:**
- **Touch Drag**: Pan around the board
- **Pinch**: Zoom (if supported)
- **Tap**: Select piece or move
- **Mobile Controls**: Use on-screen buttons for zoom, center, etc.

### Chess Pieces

Each player starts with a standard chess set:
- 8 Pawns ♙
- 2 Rooks ♖  
- 2 Knights ♘
- 2 Bishops ♗
- 1 Queen ♕
- 1 King ♔

### Movement Rules

Chess pieces follow standard movement patterns:
- **Pawns**: Move one square in cardinal directions (simplified for infinite board)
- **Rooks**: Move horizontally or vertically any number of squares
- **Bishops**: Move diagonally any number of squares  
- **Knights**: Move in L-shape (2+1 squares)
- **Queens**: Combine rook and bishop movement
- **Kings**: Move one square in any direction

### Game Features

**Infinite Board**: The board has no boundaries - pieces can move infinitely in any direction.

**Multiplayer**: Up to 100 players can join and play simultaneously. Each player gets a unique color.

**Real-time Updates**: All player moves are synchronized in real-time across all connected clients.

**Board Exploration**: Use the minimap and navigation tools to explore different areas of the infinite board.

## Server Configuration

### Port Configuration
The server runs on port 3000 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

### Player Limits
The maximum number of players is set to 100 by default. This can be changed in `server.js`:

```javascript
const MAX_PLAYERS = 100; // Change this value
```

### Spawn Distance
Pieces spawn with a minimum distance between player starting positions. This can be adjusted in `server.js`:

```javascript
const SPAWN_DISTANCE = 16; // Minimum distance between player spawn points
```

## Project Structure

```
Chess2/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── start.sh              # Unix startup script
├── public/               # Client-side files
│   ├── index.html        # Main HTML file
│   ├── css/
│   │   └── styles.css    # Responsive CSS styles
│   └── js/
│       ├── main.js       # Main application logic
│       ├── board.js      # Chess board rendering and interaction
│       ├── ui.js         # UI management and controls  
│       └── game.js       # Chess game rules and logic
└── README.md            # This file
```

## Technical Details

### Backend
- **Node.js** with Express.js for HTTP server
- **Socket.io** for real-time WebSocket communication
- **UUID** for unique player identification
- **In-memory game state** (no database required)

### Frontend  
- **Vanilla JavaScript** (no frameworks)
- **HTML5 Canvas** for board rendering
- **CSS3** with responsive design
- **Socket.io Client** for real-time communication

### Board System
- **Infinite coordinate system** using integer coordinates
- **Efficient rendering** - only visible board sections are drawn
- **Spiral spawn pattern** ensures minimum distance between players
- **Dynamic piece loading** based on viewport

## Browser Compatibility

**Desktop:**
- Chrome 60+
- Firefox 55+ 
- Safari 12+
- Edge 79+

**Mobile:**
- iOS Safari 12+
- Chrome Mobile 60+
- Android Browser 81+

## Troubleshooting

### Server Won't Start
- Check that Node.js is installed: `node --version`
- Ensure port 3000 is available or set a different port
- Check for error messages in the terminal

### Can't Connect from Other Devices
- Make sure your firewall allows connections on the port
- Use your computer's IP address instead of localhost
- Example: `http://192.168.1.100:3000` (replace with your actual IP)

### Game Performance Issues
- Try refreshing the browser
- Close other browser tabs to free up memory
- Check your internet connection for real-time updates

### Mobile Issues
- Ensure you're using a modern mobile browser
- Try both portrait and landscape orientations
- Use the mobile control buttons instead of gestures

## Development

### Adding New Features
The codebase is modular and easy to extend:

- **server.js**: Server-side game logic and Socket.io events
- **public/js/main.js**: Main application and screen management
- **public/js/board.js**: Board rendering and user interaction  
- **public/js/ui.js**: User interface and player management
- **public/js/game.js**: Chess rules and move validation

### Running in Development Mode
```bash
npm run dev
```
This uses nodemon to automatically restart the server when files change.

## License

MIT License - Feel free to modify and distribute!

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes  
4. Test thoroughly
5. Submit a pull request

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify your Node.js and browser versions
3. Try running on a different device/browser

Enjoy playing Chess 2 with your friends!
