# Dreamina AI Image Generator Server

## Overview
This is a Node.js Express server that automates interactions with the Dreamina AI image generation tool using Puppeteer. The server provides REST API endpoints to generate images using different AI models.

**Current State**: Fixed critical issues with Puppeteer selectors and deprecated methods. Ready for deployment after environment variables are configured.

## Features
- Automated login to Dreamina platform
- Image generation with multiple AI models:
  - Nano Banana
  - Image 4.0
- Health check endpoint
- RESTful API interface

## Recent Changes
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

## Environment Variables Required
- `DREAMINA_EMAIL` - Your Dreamina account email
- `DREAMINA_PASSWORD` - Your Dreamina account password
- `PORT` - Server port (defaults to 5000)

## API Endpoints
- `GET /health` - Check server status and login state
- `GET /generate/nano-banana?prompt=YOUR_PROMPT` - Generate image with Nano Banana model
- `GET /generate/image-4?prompt=YOUR_PROMPT` - Generate image with Image 4.0 model

## User Preferences
None specified yet.
