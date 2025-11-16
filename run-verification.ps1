#!/usr/bin/env pwsh
# Complete System Verification and Test Runner
# Run this after installation to ensure everything is working

param(
    [switch]$SkipTests,
    [switch]$Quick
)

$ErrorActionPreference = "Continue"

Write-Host @"
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 AI STUDY AGENT - COMPLETE VERIFICATION SUITE 🚀      ║
║                                                            ║
║   Powered by NVIDIA NIM + LangChain + ChromaDB            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Host "`n📋 Running comprehensive system checks...`n" -ForegroundColor White

$checks = @{
    Passed = 0
    Failed = 0
    Warnings = 0
}

function Test-Prerequisite {
    param(
        [string]$Name,
        [scriptblock]$TestScript,
        [string]$FailureMessage,
        [string]$WarningMessage
    )
    
    Write-Host "Testing $Name..." -ForegroundColor Yellow -NoNewline
    
    try {
        $result = & $TestScript
        if ($result) {
            Write-Host " ✅" -ForegroundColor Green
            $script:checks.Passed++
            return $true
        } else {
            if ($WarningMessage) {
                Write-Host " ⚠️" -ForegroundColor Yellow
                Write-Host "  $WarningMessage" -ForegroundColor Gray
                $script:checks.Warnings++
                return $false
            } else {
                Write-Host " ❌" -ForegroundColor Red
                Write-Host "  $FailureMessage" -ForegroundColor Gray
                $script:checks.Failed++
                return $false
            }
        }
    } catch {
        Write-Host " ❌" -ForegroundColor Red
        Write-Host "  $FailureMessage" -ForegroundColor Gray
        Write-Host "  Error: $_" -ForegroundColor DarkGray
        $script:checks.Failed++
        return $false
    }
}

# Node.js check
Test-Prerequisite -Name "Node.js (v18+)" -TestScript {
    $version = node --version 2>$null
    if ($version -match "v(\d+)") {
        $major = [int]$matches[1]
        return $major -ge 18
    }
    return $false
} -FailureMessage "Node.js 18+ required. Download from https://nodejs.org/"

# npm check
Test-Prerequisite -Name "npm package manager" -TestScript {
    npm --version 2>$null
    return $LASTEXITCODE -eq 0
} -FailureMessage "npm not found (should come with Node.js)"

# Docker check
$dockerInstalled = Test-Prerequisite -Name "Docker installation" -TestScript {
    docker --version 2>$null
    return $LASTEXITCODE -eq 0
} -FailureMessage "Docker required. Download from https://www.docker.com/"

# ChromaDB check (only if Docker is installed)
if ($dockerInstalled) {
    Test-Prerequisite -Name "ChromaDB container" -TestScript {
        $running = docker ps --filter "ancestor=chromadb/chroma" --format "{{.Names}}" 2>$null
        return $running -ne $null -and $running -ne ""
    } -WarningMessage "Start with: docker run -p 8000:8000 chromadb/chroma"
}

# node_modules check
Test-Prerequisite -Name "Dependencies installed" -TestScript {
    Test-Path "node_modules"
} -WarningMessage "Run: npm install"

# .env check
$envExists = Test-Prerequisite -Name ".env file exists" -TestScript {
    Test-Path ".env"
} -WarningMessage "Create from: cp .env.example .env"

# NVIDIA API key check
if ($envExists) {
    Test-Prerequisite -Name "NVIDIA_API_KEY configured" -TestScript {
        $content = Get-Content ".env" -Raw -ErrorAction SilentlyContinue
        return $content -match "NVIDIA_API_KEY=\S+"
    } -WarningMessage "Add your key from https://build.nvidia.com/ to .env"
}

# ChromaDB connectivity
Test-Prerequisite -Name "ChromaDB connectivity" -TestScript {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/heartbeat" -TimeoutSec 3 -ErrorAction Stop
        return $response -ne $null
    } catch {
        return $false
    }
} -WarningMessage "Start ChromaDB: docker run -p 8000:8000 chromadb/chroma"

# Build check
if (-not $Quick) {
    Write-Host "`n🔨 Building project..." -ForegroundColor Cyan
    Test-Prerequisite -Name "TypeScript compilation" -TestScript {
        npm run build:mcp 2>&1 | Out-Null
        return $LASTEXITCODE -eq 0
    } -FailureMessage "Build failed. Check for TypeScript errors."
}

# Summary
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    VERIFICATION SUMMARY                     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host "`n  ✅ Passed: " -NoNewline -ForegroundColor Green
Write-Host $checks.Passed
Write-Host "  ⚠️  Warnings: " -NoNewline -ForegroundColor Yellow
Write-Host $checks.Warnings
Write-Host "  ❌ Failed: " -NoNewline -ForegroundColor Red
Write-Host $checks.Failed

if ($checks.Failed -eq 0 -and $checks.Warnings -eq 0) {
    Write-Host "`n🎉 Perfect! All systems operational!" -ForegroundColor Green
    Write-Host "`n📝 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. npm start                  # Launch the application" -ForegroundColor White
    Write-Host "   2. .\run-all-tests.ps1        # Run complete test suite" -ForegroundColor White
} elseif ($checks.Failed -eq 0) {
    Write-Host "`n✅ Core systems ready! Address warnings for best experience." -ForegroundColor Yellow
    Write-Host "`n📝 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Fix warnings above" -ForegroundColor White
    Write-Host "   2. npm start                  # Launch when ready" -ForegroundColor White
} else {
    Write-Host "`n❌ Please fix critical failures before proceeding." -ForegroundColor Red
    Write-Host "`n📚 For help, see:" -ForegroundColor Cyan
    Write-Host "   - SETUP_GUIDE.md             # Complete setup instructions" -ForegroundColor White
    Write-Host "   - IMPLEMENTATION_SUMMARY.md  # Technical details" -ForegroundColor White
    exit 1
}

# Run tests if requested
if (-not $SkipTests -and $checks.Failed -eq 0) {
    Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║                      RUNNING TESTS                         ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    
    Write-Host "`n🧪 Test Suite 1: NVIDIA API Integration" -ForegroundColor Magenta
    npm run test:nvidia
    
    if ($LASTEXITCODE -eq 0 -and $checks.Warnings -eq 0) {
        Write-Host "`n🧪 Test Suite 2: ChromaDB & RAG Pipeline" -ForegroundColor Magenta
        npm run test:chromadb
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n🧪 Test Suite 3: Full Agent E2E" -ForegroundColor Magenta
            npm run test:agent
        }
    }
}

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║              Verification Complete - Good Luck! 🚀         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan
