# Cross-Platform Python Setup Fix

## Problem

The project was configured for Windows with hardcoded `python` and `pip` commands, which don't work on macOS where the commands are `python3` and `pip3`. This caused npm start to fail with "python: command not found".

## Solution Implemented

### 1. Cross-Platform Setup Script

Created `scripts/setup-python.js` that:

- Automatically detects available Python command (`python3` or `python`)
- Provides helpful error messages if Python is not installed
- Works on macOS, Windows, and Linux

### 2. Updated Python Setup Script

Enhanced `python/setup.py` to:

- Handle macOS Homebrew Python's externally-managed-environment
- Try installation without flags first
- Fall back to `--break-system-packages` for Homebrew Python 3.14+
- Provide helpful alternative solutions if installation fails

### 3. Updated package.json

Changed scripts to use the cross-platform Node.js wrapper:

```json
"prestart": "node scripts/setup-python.js",
"setup:python": "node scripts/setup-python.js"
```

### 4. Removed Deprecated Config

Removed `python3="/usr/bin/python3"` from `.npmrc` (deprecated in npm 10+)

### 5. Updated Documentation

Updated `python/README.md` with:

- Prerequisites for all platforms
- Automatic and manual setup instructions
- Platform-specific commands for macOS/Linux and Windows
- Virtual environment alternatives

## Testing

Successfully tested on macOS with:

- Homebrew Python 3.14
- Anaconda Python 3.11
- Both configurations work correctly

## Benefits

✅ Works on macOS, Windows, and Linux without modification
✅ Automatic Python detection
✅ Clear error messages with helpful suggestions
✅ Handles Homebrew Python's strict packaging policies
✅ No manual configuration needed

## Usage

Just run:

```bash
npm start
```

The setup runs automatically and installs Python dependencies if needed.

## Alternative Setup (If Automatic Fails)

If the automatic setup doesn't work, users can:

### Option 1: Virtual Environment (Recommended)

```bash
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# or: venv\Scripts\activate  # Windows
python -m pip install -r python/requirements.txt
npm start
```

### Option 2: Conda

```bash
conda create -n study-agent python=3.11
conda activate study-agent
python -m pip install -r python/requirements.txt
npm start
```

## Files Changed

- ✨ NEW: `scripts/setup-python.js` - Cross-platform Python detection
- 📝 `package.json` - Updated to use Node.js setup script
- 🔧 `python/setup.py` - Enhanced with macOS support
- 📚 `python/README.md` - Cross-platform documentation
- 🗑️ `.npmrc` - Removed deprecated python3 config
