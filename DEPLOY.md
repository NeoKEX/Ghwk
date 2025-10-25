# Deploying Dreamina API to Fly.io

This guide walks you through deploying your Dreamina image generation API to Fly.io.

## Prerequisites

1. **Fly.io Account**: Sign up at https://fly.io
2. **Fly CLI**: Install the Fly.io command-line tool

### Install Fly CLI

**macOS/Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

**Windows (PowerShell):**
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

## Deployment Steps

### 1. Login to Fly.io
```bash
flyctl auth login
```

### 2. Launch Your App
From your project directory:
```bash
flyctl launch
```

When prompted:
- **App name**: Choose a unique name (e.g., `dreamina-api-yourname`) or press Enter for auto-generated
- **Region**: Choose the region closest to you (e.g., `iad` for US East)
- **Would you like to set up a Postgresql database?**: Select **No**
- **Would you like to set up an Upstash Redis database?**: Select **No**
- **Would you like to deploy now?**: Select **No** (we need to add secrets first)

### 3. Add Your Dreamina Credentials as Secrets
```bash
flyctl secrets set DREAMINA_EMAIL="your-email@example.com"
flyctl secrets set DREAMINA_PASSWORD="your-password"
```

Replace with your actual Dreamina account credentials.

### 4. Deploy Your App
```bash
flyctl deploy
```

This will:
- Build your Docker image
- Upload it to Fly.io
- Start your app with 1GB RAM (recommended for Puppeteer)

### 5. Verify Deployment

Check if your app is running:
```bash
flyctl status
```

View logs:
```bash
flyctl logs
```

Open your app in browser:
```bash
flyctl open
```

## Testing Your API

Once deployed, your API will be available at: `https://your-app-name.fly.dev`

### Test the health endpoint:
```bash
curl https://your-app-name.fly.dev/health
```

### Generate an image with Nano Banana:
```bash
curl "https://your-app-name.fly.dev/generate/nano-banana?prompt=beautiful%20sunset%20over%20mountains"
```

### Generate an image with Image 4.0:
```bash
curl "https://your-app-name.fly.dev/generate/image-4?prompt=cyberpunk%20city%20at%20night"
```

## Useful Commands

**View app info:**
```bash
flyctl info
```

**Scale memory (if needed):**
```bash
flyctl scale memory 2048  # 2GB
```

**View secrets:**
```bash
flyctl secrets list
```

**SSH into your app:**
```bash
flyctl ssh console
```

**Restart your app:**
```bash
flyctl apps restart
```

**Delete your app:**
```bash
flyctl apps destroy your-app-name
```

## Troubleshooting

### Issue: "Could not find Chrome"
- The Dockerfile installs Chromium automatically
- Check logs: `flyctl logs`

### Issue: Out of memory
- Scale to 2GB: `flyctl scale memory 2048`

### Issue: Login timeout
- Increase timeout in code or check Dreamina website status
- View detailed logs: `flyctl logs -a your-app-name`

### Issue: App not starting
- Check logs: `flyctl logs`
- Verify secrets are set: `flyctl secrets list`

## Monitoring

View real-time logs:
```bash
flyctl logs -f
```

View metrics:
```bash
flyctl dashboard
```

## Costs

Fly.io pricing (as of 2025):
- **Free tier**: Includes small machines (enough for testing)
- **Hobby plan**: $5/month for basic apps
- Your app with 1GB RAM will cost approximately $5-10/month

For current pricing, visit: https://fly.io/docs/about/pricing/

## Support

- Fly.io Documentation: https://fly.io/docs/
- Community Forum: https://community.fly.io/
