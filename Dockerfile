# syntax = docker/dockerfile:1

# Base stage with Node.js
FROM node:20-slim as base

WORKDIR /app

# Install Chromium and all required dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-khmeros \
    fonts-kacst \
    fonts-freefont-ttf \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    chromium \
    chromium-sandbox \
    dbus \
    dbus-x11 \
    --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set environment for DBUS
ENV DBUS_SESSION_BUS_ADDRESS=autolaunch:

# Build stage - install dependencies
FROM base as build
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM base
COPY --from=build /app/node_modules ./node_modules
COPY . .

# Set port environment variable
ENV PORT=8080
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
