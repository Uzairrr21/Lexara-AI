#!/bin/bash
# Run this script once to download face-api.js model weights

DIR="frontend/public/models"
mkdir -p "$DIR"
cd "$DIR"

BASE="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"

files=(
  "ssd_mobilenetv1_model-weights_manifest.json"
  "ssd_mobilenetv1_model-shard1"
  "ssd_mobilenetv1_model-shard2"
  "face_landmark_68_model-weights_manifest.json"
  "face_landmark_68_model-shard1"
  "face_recognition_model-weights_manifest.json"
  "face_recognition_model-shard1"
  "face_recognition_model-shard2"
)

echo "Downloading face-api.js models..."
for f in "${files[@]}"; do
  echo "  → $f"
  curl -# -O "$BASE/$f"
done

echo ""
echo "✅ Models downloaded to $DIR"
echo "You can now use Face ID login!"
