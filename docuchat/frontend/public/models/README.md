# Face-API.js Model Files

Download the required model files and place them in this directory.

## Required Models

Download from: https://github.com/justadudewhohacks/face-api.js/tree/master/weights

Required files:
- ssd_mobilenetv1_model-weights_manifest.json
- ssd_mobilenetv1_model-shard1
- face_landmark_68_model-weights_manifest.json  
- face_landmark_68_model-shard1
- face_recognition_model-weights_manifest.json
- face_recognition_model-shard1
- face_recognition_model-shard2

## Quick Download Script

```bash
# Run from the frontend/public/models directory
BASE="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"

files=(
  "ssd_mobilenetv1_model-weights_manifest.json"
  "ssd_mobilenetv1_model-shard1"
  "face_landmark_68_model-weights_manifest.json"
  "face_landmark_68_model-shard1"
  "face_recognition_model-weights_manifest.json"
  "face_recognition_model-shard1"
  "face_recognition_model-shard2"
)

for f in "${files[@]}"; do
  curl -O "$BASE/$f"
done
```
