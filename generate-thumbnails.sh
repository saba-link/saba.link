#!/bin/bash
# Generate CV thumbnails from PDFs
# Requires: pdftoppm (poppler-utils) or convert (ImageMagick)

set -e

cd "$(dirname "$0")/public"

echo "Generating CV thumbnails..."

# Check for pdftoppm (preferred, better quality)
if command -v pdftoppm &> /dev/null; then
    echo "Using pdftoppm..."
    pdftoppm -png -f 1 -l 1 -scale-to 560 CV-Dark.pdf CV-Dark-thumb
    mv CV-Dark-thumb-1.png CV-Dark-thumb.png
    
    pdftoppm -png -f 1 -l 1 -scale-to 560 CV-Light.pdf CV-Light-thumb
    mv CV-Light-thumb-1.png CV-Light-thumb.png
    
# Fallback to ImageMagick
elif command -v convert &> /dev/null; then
    echo "Using ImageMagick..."
    convert -density 150 CV-Dark.pdf[0] -resize 560x -quality 90 CV-Dark-thumb.png
    convert -density 150 CV-Light.pdf[0] -resize 560x -quality 90 CV-Light-thumb.png
    
else
    echo "Error: Neither pdftoppm nor ImageMagick found."
    echo "Install with: brew install poppler (Mac) or apt install poppler-utils (Linux)"
    exit 1
fi

echo "✓ Generated:"
ls -la CV-*-thumb.png
