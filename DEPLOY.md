# 🚀 Deployment Guide - AI Study Agent

This guide explains how to build and release your Electron app for macOS with integrated Python dependencies.

## 📋 Prerequisites

- macOS machine (for local builds)
- Node.js 20+ installed
- Python 3.12 installed
- GitHub account with repository
- (Optional) Apple Developer Account for code signing

## 🏗️ Build Process Overview

The build process:

1. ✅ Installs Node.js dependencies
2. ✅ Creates Python virtual environment using `uv`
3. ✅ Installs Python packages (ChromaDB, LangChain, NVIDIA endpoints)
4. ✅ Rebuilds native modules for Electron (better-sqlite3, chromadb)
5. ✅ Builds MCP server TypeScript code
6. ✅ Packages everything into a macOS app bundle
7. ✅ Creates DMG and ZIP distributables

## 🔧 Local Build

### 1. Build for Local Testing

```bash
# Install dependencies
npm install

# Build the app (creates .app bundle)
npm run package

# The app will be in: out/ai study agent-darwin-arm64/
```

### 2. Create Distributable DMG/ZIP

```bash
# Create release-ready packages
npm run make

# Output will be in: out/make/
# - AI-Study-Agent.dmg (installer)
# - ai-study-agent-darwin-arm64-1.0.0.zip (portable)
```

## 🤖 GitHub Actions Release (Recommended)

### Setup Steps

#### 1. **Create GitHub Repository Secrets** (Optional - for code signing)

If you have an Apple Developer account and want to sign your app:

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:

- `APPLE_ID`: Your Apple ID email
- `APPLE_ID_PASSWORD`: App-specific password from appleid.apple.com
- `APPLE_TEAM_ID`: Your 10-character Team ID

> **Note**: The workflow works fine WITHOUT code signing. Unsigned apps require users to right-click → Open on first launch.

#### 2. **Enable GitHub Actions**

Go to your repository → Settings → Actions → General

- Enable "Read and write permissions"
- Enable "Allow GitHub Actions to create and approve pull requests"

#### 3. **Trigger a Release**

**Option A: Create a Git Tag (Recommended)**

```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

**Option B: Manual Trigger**

1. Go to your repository → Actions tab
2. Select "Build and Release macOS"
3. Click "Run workflow" → "Run workflow"

### What Happens Automatically

The GitHub Action will:

1. ✅ Set up macOS runner with Node.js 20 and Python 3.12
2. ✅ Install `uv` for fast Python package management
3. ✅ Create virtual environment with all Python dependencies
4. ✅ Rebuild native modules for your Electron version
5. ✅ Build and package your app
6. ✅ Create a GitHub Release with:
   - DMG installer (drag-to-install)
   - ZIP archive (portable)
   - Auto-generated release notes

### Release Output

After the action completes, you'll have a release at:
`https://github.com/YOUR_USERNAME/YOUR_REPO/releases`

**Downloads available:**

- `AI-Study-Agent.dmg` - Drag-to-Applications installer
- `ai-study-agent-darwin-arm64-1.0.0.zip` - Portable app

## 📦 What's Included in the App

Your packaged app includes:

- ✅ Electron app with all UI/frontend code
- ✅ Python 3.12 virtual environment (`.venv`)
- ✅ All Python packages (ChromaDB, LangChain, NVIDIA AI)
- ✅ Native modules compiled for macOS
- ✅ MCP server code
- ✅ Scripts for Python setup
- ✅ Configuration files

**Users don't need to install anything** - it's completely self-contained!

## 🔍 Troubleshooting

### Build Fails with Native Module Errors

```bash
# Locally rebuild native modules
npm rebuild better-sqlite3 --build-from-source
npm rebuild chromadb --build-from-source
```

### Python Virtual Environment Issues

The app uses `uv` for fast, reliable Python dependency management:

```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Recreate venv
rm -rf .venv
uv venv .venv --python 3.12
uv pip install -r python/requirements.txt --python .venv/bin/python
```

### GitHub Action Fails

Check the Actions tab logs. Common issues:

- **Missing secrets**: App will build but won't be code-signed (this is OK!)
- **Python dependency conflicts**: Check `python/requirements.txt`
- **Out of disk space**: GitHub runners have limited space

### App Won't Open on macOS

**"App is damaged and can't be opened"**

This happens with unsigned apps. Users should:

1. Right-click the app → Open (first time only)
2. Click "Open" in the dialog
3. App will now open normally

Or remove quarantine attribute:

```bash
xattr -cr "/Applications/ai study agent.app"
```

## 🎯 Release Checklist

Before creating a new release:

- [ ] Test app locally with `npm run package`
- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md` (optional)
- [ ] Commit all changes
- [ ] Create and push git tag
- [ ] Wait for GitHub Action to complete
- [ ] Test downloaded DMG
- [ ] Announce release! 🎉

## 📝 Version Numbering

Use semantic versioning:

- `v1.0.0` - Major release
- `v1.1.0` - New features
- `v1.0.1` - Bug fixes

## 🔐 Code Signing (Optional)

To enable code signing and notarization:

1. Enroll in Apple Developer Program ($99/year)
2. Create certificates in Xcode
3. Add GitHub secrets (APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID)
4. Uncomment the `osxSign` and `osxNotarize` sections in `forge.config.ts`
5. Create `entitlements.plist` file (example provided below)

**Benefits of code signing:**

- Users can double-click to open (no "right-click → Open" needed)
- App appears as verified in System Settings
- Better security and trust

**Without code signing:**

- App still works perfectly
- Users need to right-click → Open on first launch
- No recurring costs

## 📄 Files Involved

- `.github/workflows/release.yml` - GitHub Actions workflow
- `forge.config.ts` - Electron Forge configuration
- `package.json` - App metadata and scripts
- `python/requirements.txt` - Python dependencies
- `scripts/setup-python.js` - Python environment setup

## 🎓 Next Steps

1. **Test Locally**: Run `npm run make` to ensure everything builds
2. **Create First Release**: Push a `v1.0.0` tag
3. **Share**: Download and test the DMG from GitHub Releases
4. **Iterate**: Make changes, bump version, push new tag

## 💡 Tips

- Use pre-releases for testing: `v1.0.0-beta.1`
- Keep release notes informative for users
- Test on a clean Mac without dev tools installed
- Monitor GitHub Actions usage (free tier has limits)

---

**Need help?** Check the GitHub Actions logs or create an issue in your repository.
