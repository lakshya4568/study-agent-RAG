# Full RAG Integration Test Runner
# Tests the complete pipeline: Document Loading → Chunking → Embedding → Vector Store → Semantic Search

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  RAG Pipeline Integration Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check for .env file
if (-not (Test-Path ".env")) {
    Write-Host "❌ ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "`nPlease create a .env file with your NVIDIA API key:" -ForegroundColor Yellow
    Write-Host "NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`n" -ForegroundColor Gray
    exit 1
}

# Check if NVIDIA_API_KEY is set
$envContent = Get-Content ".env" -Raw
if ($envContent -notmatch "NVIDIA_API_KEY=") {
    Write-Host "❌ ERROR: NVIDIA_API_KEY not found in .env!" -ForegroundColor Red
    Write-Host "`nAdd your NVIDIA API key to .env:" -ForegroundColor Yellow
    Write-Host "NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`n" -ForegroundColor Gray
    exit 1
}

Write-Host "✅ Environment configured" -ForegroundColor Green

# Check Python dependencies
Write-Host "`n📦 Checking Python dependencies..." -ForegroundColor Cyan
try {
    python -c "import langchain_nvidia_ai_endpoints" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Python dependencies installed" -ForegroundColor Green
    } else {
        throw "Import failed"
    }
} catch {
    Write-Host "⚠️  Installing Python dependencies..." -ForegroundColor Yellow
    pip install -r python/requirements.txt
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install Python dependencies" -ForegroundColor Red
        exit 1
    }
}

# Run the integration test
Write-Host "`n🚀 Running full integration test..." -ForegroundColor Cyan
Write-Host "(This may take 30-60 seconds)`n" -ForegroundColor Gray

npx tsx tests/test-full-integration.ts

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "  ✅ INTEGRATION TEST PASSED" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Green
    Write-Host "The RAG pipeline is fully functional!" -ForegroundColor Green
    Write-Host "You can now run 'npm start' to use the app.`n" -ForegroundColor Cyan
} else {
    Write-Host "`n========================================" -ForegroundColor Red
    Write-Host "  ❌ INTEGRATION TEST FAILED" -ForegroundColor Red
    Write-Host "========================================`n" -ForegroundColor Red
    Write-Host "Check the error messages above for details.`n" -ForegroundColor Yellow
    exit 1
}
