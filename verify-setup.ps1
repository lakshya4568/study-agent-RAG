#!/usr/bin/env pwsh
# AI Study Agent - Quick Verification Script
# Checks all prerequisites and runs tests

Write-Host "🔍 AI Study Agent - System Verification" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

$allGood = $true

# Check 1: Node.js
Write-Host "1️⃣  Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "   ✅ Node.js $nodeVersion installed" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js not found. Install from https://nodejs.org/" -ForegroundColor Red
    $allGood = $false
}

# Check 2: Docker
Write-Host "`n2️⃣  Checking Docker installation..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "   ✅ Docker installed: $dockerVersion" -ForegroundColor Green
    
    # Check if ChromaDB is running
    $chromaRunning = docker ps --filter "ancestor=chromadb/chroma" --format "{{.Status}}"
    if ($chromaRunning) {
        Write-Host "   ✅ ChromaDB container is running" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  ChromaDB not running. Start it with:" -ForegroundColor Yellow
        Write-Host "      docker run -p 8000:8000 chromadb/chroma" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Docker not found. Install from https://www.docker.com/" -ForegroundColor Red
    $allGood = $false
}

# Check 3: .env file
Write-Host "`n3️⃣  Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "   ✅ .env file exists" -ForegroundColor Green
    
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "NVIDIA_API_KEY=.+") {
        Write-Host "   ✅ NVIDIA_API_KEY is configured" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  NVIDIA_API_KEY not set in .env" -ForegroundColor Yellow
        Write-Host "      Get your key from: https://build.nvidia.com/" -ForegroundColor Gray
        $allGood = $false
    }
} else {
    Write-Host "   ⚠️  .env file not found. Create from .env.example" -ForegroundColor Yellow
    Write-Host "      cp .env.example .env" -ForegroundColor Gray
    $allGood = $false
}

# Check 4: Dependencies
Write-Host "`n4️⃣  Checking npm dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "   ✅ node_modules exists" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Dependencies not installed. Run: npm install" -ForegroundColor Yellow
    $allGood = $false
}

# Check 5: ChromaDB connectivity
Write-Host "`n5️⃣  Checking ChromaDB connectivity..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/heartbeat" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "   ✅ ChromaDB is accessible at http://localhost:8000" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Cannot reach ChromaDB at http://localhost:8000" -ForegroundColor Red
    Write-Host "      Start it with: docker run -p 8000:8000 chromadb/chroma" -ForegroundColor Gray
    $allGood = $false
}

# Final verdict
Write-Host "`n" -ForegroundColor White
Write-Host "======================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "✅ All checks passed! You're ready to go!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "  1. npm run build:mcp    # Build MCP components" -ForegroundColor White
    Write-Host "  2. npm run test:all     # Run all tests" -ForegroundColor White
    Write-Host "  3. npm start            # Start the application" -ForegroundColor White
} else {
    Write-Host "⚠️  Some checks failed. Fix the issues above." -ForegroundColor Yellow
    Write-Host "`nFor help, see: SETUP_GUIDE.md" -ForegroundColor Cyan
}
Write-Host "======================================`n" -ForegroundColor Cyan
