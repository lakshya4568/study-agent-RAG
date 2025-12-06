# 🚀 AI Study Agent - Setup Guide

## First-Time Setup

### 1. Get Your NVIDIA API Key (Free!)

1. Go to [https://build.nvidia.com/](https://build.nvidia.com/)
2. Sign up for a free account
3. Click on any model (e.g., "llama-3.1-nemotron-70b-instruct")
4. Click "Get API Key" button
5. Copy your API key (starts with `nvapi-`)

### 2. Configure the App

After installing the app, you need to add your API key:

**Method 1: Create .env file in app directory**

1. Right-click on "ai study agent.app" → "Show Package Contents"
2. Navigate to `Contents/Resources/`
3. Create a file named `.env` (note the dot at the start)
4. Add this content:
   ```
   NVIDIA_API_KEY="nvapi-YOUR-KEY-HERE"
   ```
5. Save and close

**Method 2: Use the app's Settings (if available)**

1. Open the app
2. Go to Settings
3. Paste your NVIDIA API key
4. Click Save

### 3. Launch the App

1. Double-click the app
2. If it's your first time, right-click → Open (for unsigned apps)
3. The RAG service will start automatically
4. Start chatting with your AI study buddy! 🎓

## Troubleshooting

**"RAG service not connected" error:**

- Make sure you created the `.env` file with your API key
- Restart the app after adding the key
- Check that the API key is valid on [build.nvidia.com](https://build.nvidia.com/)

**"Cannot open app" on macOS:**

- Right-click the app → Open (don't double-click)
- Click "Open" in the security dialog
- This only needs to be done once

## Support

Need help? Check the documentation or open an issue on GitHub!

Happy studying! 📚🤖