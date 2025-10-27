# Dreamina Image Generation API

A REST API server that generates AI images using Dreamina (CapCut's AI platform) through browser automation with Puppeteer.

## Features

- 🎨 **Two AI Models**: Nano Banana and Image 4.0
- 🚀 **Simple REST API**: Easy-to-use endpoints
- 🔄 **Cookie-Based Auth**: Persistent login using Netscape cookies
- 🐳 **Docker Ready**: Configured for Fly.io deployment
- 📊 **Health Checks**: Monitor server status and login state

## API Endpoints

### Health Check
```bash
GET /health
```
Returns server status and login state.

### Generate Image (Nano Banana Model)
```bash
GET /generate/nano-banana?prompt=YOUR_PROMPT
```

### Generate Image (Image 4.0 Model)
```bash
GET /generate/image-4?prompt=YOUR_PROMPT
```

## Example Usage

```bash
# Check server health
curl "http://localhost:3000/health"

# Generate an image
curl "http://localhost:3000/generate/nano-banana?prompt=beautiful%20sunset%20over%20mountains"
```

## Local Development

### Prerequisites
- Node.js 20 or higher
- A Dreamina account (free at https://dreamina.capcut.com)
- Browser cookies from your logged-in Dreamina session

### Setup

1. Install dependencies:
```bash
npm install
```

2. Export your Dreamina cookies in Netscape format:
   - Log in to https://dreamina.capcut.com in your browser
   - Export cookies using a browser extension (e.g., "Get cookies.txt LOCALLY" for Chrome/Firefox)
   - Save the cookies as `account.txt` in the root directory

3. Run the server:
```bash
node server.js
```

The server will start on port 3000 (or PORT environment variable).

## Deploy to Fly.io

This app is configured for easy deployment to Fly.io. See [DEPLOY.md](DEPLOY.md) for complete deployment instructions.

### Quick Deploy

1. Install Fly CLI and login:
```bash
curl -L https://fly.io/install.sh | sh
flyctl auth login
```

2. Upload your `account.txt` file with your Dreamina cookies to the deployed app

3. Launch and deploy:
```bash
flyctl launch
flyctl deploy
```

Your API will be live at `https://your-app-name.fly.dev`

## Configuration

- **PORT**: Server port (default: 3000, Fly.io uses 8080)
- **account.txt**: Netscape format cookie file with your Dreamina session

## Technical Details

- **Framework**: Express.js
- **Browser Automation**: Puppeteer
- **Docker Base**: Node 20 slim with Chromium
- **Memory Requirements**: Minimum 1GB RAM (for Puppeteer/Chrome)

## Notes

⚠️ This API uses browser automation to interact with Dreamina's web interface. It's not an official API and may break if Dreamina updates their UI.

## License

MIT
