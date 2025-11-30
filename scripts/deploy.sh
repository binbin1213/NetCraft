#!/bin/bash

# Exit on error
set -e

# Ensure we are in the project root
cd "$(dirname "$0")/.."

echo "=== NetCraft Deployment Helper ==="

# Check for .env file or API key
if [ -z "$DASHSCOPE_API_KEY" ]; then
    echo "Warning: DASHSCOPE_API_KEY environment variable is not set."
    echo "AI features might not work."
    read -p "Do you want to continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "Stopping existing containers..."
docker-compose down

echo "Starting services..."
docker-compose up --build -d

echo "--------------------------------"
echo "✅ NetCraft is running!"
echo "Frontend: http://localhost"
