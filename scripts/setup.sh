#!/bin/bash

# MongoDB Learning Labs - Setup Script
# Creates Python virtual environment and installs dependencies

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$PROJECT_ROOT/venv"

echo "🚀 MongoDB Learning Labs - Setup"
echo "=================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"
echo ""

# Create virtual environment if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
    echo "✅ Virtual environment created at: $VENV_DIR"
    echo ""
else
    echo "✅ Virtual environment already exists at: $VENV_DIR"
    echo ""
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source "$VENV_DIR/bin/activate"
echo "✅ Virtual environment activated"
echo ""

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip
echo "✅ pip upgraded"
echo ""

# Install dependencies
echo "📦 Installing dependencies from requirements.txt..."
pip install -r "$PROJECT_ROOT/requirements.txt"
echo "✅ Dependencies installed"
echo ""

echo "=================================="
echo "✨ Setup complete!"
echo ""
echo "To use the virtual environment in the future, run:"
echo "  source venv/bin/activate"
echo ""
echo "To deactivate the virtual environment, run:"
echo "  deactivate"
echo ""
echo "To start the MkDocs server, run:"
echo "  mkdocs serve"
echo ""

