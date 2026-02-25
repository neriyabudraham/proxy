#!/bin/bash

# Proxy Manager Deployment Script
# Run this script on your server after git pull

set -e

echo "🚀 Starting deployment..."

# Go to project directory
cd /www/wwwroot/proxy.botomat.co.il

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Check if .env exists, if not create from template
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "📋 Creating .env from .env.production template..."
    cp .env.production .env
    echo ""
    echo "🔧 IMPORTANT: Edit .env file with your actual credentials:"
    echo "   nano .env"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Build and start with Docker Compose
echo "🐳 Building and starting Docker container..."
docker compose down || true
docker compose build --no-cache
docker compose up -d

# Wait for container to be ready
echo "⏳ Waiting for container to start..."
sleep 5

# Initialize database if needed
echo "🗄️ Initializing database..."
docker compose exec -T proxy-manager npx prisma db push || true

# Check container status
echo "✅ Checking container status..."
docker compose ps

echo ""
echo "✨ Deployment complete!"
echo "🌐 Site: https://proxy.botomat.co.il"
echo ""
echo "📝 Useful commands:"
echo "   docker compose logs -f          # View logs"
echo "   docker compose restart          # Restart container"
echo "   docker compose down              # Stop container"
