#!/bin/bash

# Chess 2 - Infinite Multiplayer Chess
# Startup script for Unix systems

echo "🏁 Starting Chess 2 Server..."
echo "================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    echo "Minimum version required: 16.0.0"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "⚠️  Warning: Node.js version may be too old"
    echo "Current version: $(node -v)"
    echo "Recommended version: 16.0.0 or higher"
    echo ""
fi

# Check if npm is installed
if ! command -v npm &> /dev/null
then
    echo "❌ npm is not installed!"
    echo "npm usually comes with Node.js. Please reinstall Node.js."
    exit 1
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found!"
    echo "Make sure you're running this script from the Chess2 directory."
    exit 1
fi

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies!"
        exit 1
    fi
    echo "✅ Dependencies installed successfully!"
    echo ""
fi

# Get local IP address for network access info
if command -v ifconfig &> /dev/null; then
    LOCAL_IP=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1)
elif command -v ip &> /dev/null; then
    LOCAL_IP=$(ip route get 8.8.8.8 2>/dev/null | grep -Po '(?<=src )(\d+\.){3}\d+' | head -1)
else
    LOCAL_IP="your.local.ip"
fi

# Display startup info
echo "🚀 Starting Chess 2 server..."
echo ""
echo "📋 Server Information:"
echo "   • Max Players: 100"
echo "   • Default Port: 3000"
echo "   • Node.js Version: $(node -v)"
echo ""
echo "🌐 Access URLs:"
echo "   • Local:    http://localhost:3000"
if [ "$LOCAL_IP" != "your.local.ip" ]; then
echo "   • Network:  http://$LOCAL_IP:3000"
fi
echo ""
echo "📱 Mobile Access:"
echo "   Friends can join from their phones using the network URL above"
echo ""
echo "⌨️  Controls:"
echo "   • Press Ctrl+C to stop the server"
echo ""
echo "================================="
echo ""

# Start the server
node server.js

# Handle script exit
echo ""
echo "🛑 Server stopped."
echo "Thanks for playing Chess 2!"
