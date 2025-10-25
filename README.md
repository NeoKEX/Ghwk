# Dreamina Image Generation API

A REST API server that generates AI images using Dreamina (CapCut's AI platform) through browser automation with Puppeteer.

## Features

- 🎨 **Two AI Models**: Nano Banana and Image 4.0
- 🚀 **Simple REST API**: Easy-to-use endpoints
- 🔄 **Automated Login**: Handles Dreamina authentication automatically
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

### Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env` file or set as secrets:
```
DREAMINA_EMAIL=your-email@example.com
DREAMINA_PASSWORD=your-password
```

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

2. Launch and deploy:
```bash
flyctl launch
flyctl secrets set DREAMINA_EMAIL="your-email@example.com"
flyctl secrets set DREAMINA_PASSWORD="your-password"
flyctl deploy
```

Your API will be live at `https://your-app-name.fly.dev`

## Configuration

- **PORT**: Server port (default: 3000, Fly.io uses 8080)
- **DREAMINA_EMAIL**: Your Dreamina account email
- **DREAMINA_PASSWORD**: Your Dreamina account password

## Technical Details

- **Framework**: Express.js
- **Browser Automation**: Puppeteer
- **Docker Base**: Node 20 slim with Chromium
- **Memory Requirements**: Minimum 1GB RAM (for Puppeteer/Chrome)

## Notes

⚠️ This API uses browser automation to interact with Dreamina's web interface. It's not an official API and may break if Dreamina updates their UI.

## License

MIT
