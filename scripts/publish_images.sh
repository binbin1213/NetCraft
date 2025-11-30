#!/bin/bash

# Exit on error
set -e

# Ensure we are in the project root
cd "$(dirname "$0")/.."

# Default username
USERNAME=${1}

if [ -z "$USERNAME" ]; then
    echo "Usage: ./scripts/publish_images.sh <dockerhub_username>"
    exit 1
fi

echo "=== NetCraft Image Publisher ==="
echo "Target User: $USERNAME"

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running."
    exit 1
fi

# Build and Push Frontend
echo "--------------------------------"
echo "Building Frontend Image..."
docker build -t $USERNAME/netcraft-frontend:latest ./frontend

echo "Pushing Frontend Image..."
docker push $USERNAME/netcraft-frontend:latest

# Build and Push Backend
echo "--------------------------------"
echo "Building Backend Image..."
docker build -t $USERNAME/netcraft-backend:latest ./backend

echo "Pushing Backend Image..."
docker push $USERNAME/netcraft-backend:latest

echo "--------------------------------"
echo "✅ All images published successfully!"
