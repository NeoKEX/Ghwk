# Dreamina AI Image Generator Server

## Overview
This is a Node.js Express server that automates interactions with the Dreamina AI image generation tool using Puppeteer. The server provides REST API endpoints to generate images using different AI models.

**Current State**: Cookie-based authentication implemented. Server loads session from `account.txt` (Netscape format). 

**IMPORTANT**: This server is hosted on fly.io, NOT on Replit. Replit is used only as a code editor. Do not create workflows or attempt to run the server on Replit.

## Features
- Cookie-based authentication (secure, persistent sessions)
- Image generation with multiple AI models:
  - Nano Banana
  - Image 4.0
- Health check endpoint
- RESTful API interface

## Recent Changes
- **October 27, 2025**: Major fix for image detection logic
  - **NEW vs. EXISTING image tracking**: Now tracks existing images BEFORE generation starts, then only extracts NEW images
  - **Removed manual navigation**: Eliminated manual navigation that was causing "Execution context destroyed" errors
  - **Better generation detection**: Checks for loading indicators (spinners, "Generating" text) to confirm when generation is complete
  - **Faster polling**: Reduced from 120s/5s intervals to 60s/3s intervals (Dreamina generates in 30-40s)
  - **Stricter image filters**: Increased minimum image size from 150px to 180px to avoid false positives
  - **Fixed infinite gallery bug**: Previous code was returning 36 old gallery images instead of the 4 newly generated ones
  - **Extended navigation timeout**: Increased navigation wait from 20s to 30s for slower networks
- **October 26, 2025**: Fixed navigation timeout issues for fly.io deployment
  - **Page reuse optimization**: Browser now reuses the current page (home or generate) instead of navigating on every request
  - **No unnecessary navigation**: Only navigates when starting from a different page
  - **Navigation detection**: Actively waits for URL to change to /ai-tool/generate after clicking generate button
  - Removed unnecessary Create button click (prompt input is already visible on home page)
  - Enhanced prompt input detection with 8 retry attempts and multiple fallback strategies
  - Returns image URLs directly (no base64 downloading to reduce latency)
- **October 25, 2025**: Switched to cookie-based authentication
  - Implemented Netscape cookie parser
  - Replaced email/password login with cookie loading from `account.txt`
  - Added proper security by not storing sensitive cookies in environment variables
  - Created `account.txt.example` to show cookie format
  - Updated README with new authentication method
- **October 25, 2025**: Fixed Puppeteer deprecated methods and selectors
  - Replaced `page.waitForTimeout()` with `setTimeout` promises
  - Removed Playwright-specific `:has-text()` selectors
  - Removed hardcoded Chromium executable path
  - Added proper error handling
  - Created .gitignore for Node.js projects
  - Added start script to package.json

## Project Architecture
- `server.js` - Main server file with Express routes and Puppeteer automation
- `package.json` - Node.js dependencies and scripts
- `.env` - Environment variables (not tracked in git)

## Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js v5.1.0
- **Browser Automation**: Puppeteer v24.26.1
- **Environment Variables**: dotenv v17.2.3

## Configuration Required
- `account.txt` - Netscape format cookie file with Dreamina session cookies
- `PORT` - Server port (environment variable, defaults to 3000)

## How to Get Cookies
1. Log in to https://dreamina.capcut.com in your browser
2. Use a browser extension like "Get cookies.txt LOCALLY" (Chrome/Firefox)
3. Export cookies in Netscape format
4. Save the exported file as `account.txt` in the root directory

## API Endpoints
- `GET /health` - Check server status and login state
- `GET /generate/nano-banana?prompt=YOUR_PROMPT` - Generate image with Nano Banana model
- `GET /generate/image-4?prompt=YOUR_PROMPT` - Generate image with Image 4.0 model

## User Preferences
None specified yet.
