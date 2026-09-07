# PowerShell script to download face-api.js model weights
# Run from the docuchat root folder:
# powershell -ExecutionPolicy Bypass -File docuchat/download-face-models.ps1

$modelDir = "docuchat\frontend\public\models"

# Create the folder if it doesn't exist
if (-Not (Test-Path $modelDir)) {
    New-Item -ItemType Directory -Path $modelDir -Force | Out-Null
}

$base = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"

$files = @(
    "ssd_mobilenetv1_model-weights_manifest.json",
    "ssd_mobilenetv1_model-shard1",
    "ssd_mobilenetv1_model-shard2",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
)

Write-Host ""
Write-Host "Downloading face-api.js models..." -ForegroundColor Cyan
Write-Host ""

foreach ($file in $files) {
    $url = "$base/$file"
    $dest = "$modelDir\$file"

    if (Test-Path $dest) {
        Write-Host "  [SKIP] $file (already exists)" -ForegroundColor Yellow
        continue
    }

    Write-Host "  Downloading $file ..." -ForegroundColor White
    try {
        Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
        Write-Host "  [OK]   $file" -ForegroundColor Green
    } catch {
        Write-Host "  [FAIL] $file - $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Done! Models saved to: $modelDir" -ForegroundColor Green
Write-Host "You can now use Face ID login in the app." -ForegroundColor Green
Write-Host ""