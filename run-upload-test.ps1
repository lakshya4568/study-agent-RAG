# PowerShell script to run the document upload test
# This script ensures proper error handling and displays results clearly

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "Document Upload Test Runner" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Warning: .env file not found" -ForegroundColor Yellow
    Write-Host "   Make sure NVIDIA_API_KEY is configured`n" -ForegroundColor Yellow
}

# Check if test file exists
if (-not (Test-Path "tests\test-document-upload.ts")) {
    Write-Host "❌ Error: Test file not found at tests\test-document-upload.ts" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Starting test...`n" -ForegroundColor Green

# Run the test
try {
    npm run test:upload
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host "`n✅ Test completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Test failed with exit code: $exitCode" -ForegroundColor Red
    }
    
    exit $exitCode
} catch {
    Write-Host "`n❌ Error running test: $_" -ForegroundColor Red
    exit 1
}
