require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 5000;

let browser = null;
let page = null;
let isLoggedIn = false;

async function initializeBrowser() {
  console.log('Initializing browser...');
  
  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ],
    timeout: 60000
  };
  
  browser = await puppeteer.launch(launchOptions);
  page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('✅ Browser initialized');
}

async function loginToDreamina() {
  console.log('Logging in to Dreamina...');
  
  try {
    await page.goto('https://dreamina.capcut.com/ai-tool/home/', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    await page.waitForTimeout(5000);
    
    const loginClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const loginBtn = buttons.find(btn => 
        btn.textContent.toLowerCase().includes('log in') || 
        btn.textContent.toLowerCase().includes('sign in')
      );
      if (loginBtn) {
        loginBtn.click();
        return true;
      }
      return false;
    });
    
    if (!loginClicked) {
      throw new Error('Could not find login button');
    }
    
    await page.waitForTimeout(3000);
    
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button, div, span'));
      const emailOption = elements.find(el => 
        el.textContent.toLowerCase().includes('email') ||
        el.textContent.toLowerCase().includes('continue with email')
      );
      if (emailOption) emailOption.click();
    });
    
    await page.waitForTimeout(2000);
    
    const emailInput = await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    await emailInput.type(process.env.DREAMINA_EMAIL);
    console.log('✅ Email entered');
    
    await page.waitForTimeout(1000);
    
    const passwordInput = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await passwordInput.type(process.env.DREAMINA_PASSWORD);
    console.log('✅ Password entered');
    
    await page.waitForTimeout(1000);
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const submitBtn = buttons.find(btn => 
        btn.textContent.toLowerCase().includes('log in') ||
        btn.textContent.toLowerCase().includes('sign in') ||
        btn.textContent.toLowerCase().includes('continue')
      );
      if (submitBtn) submitBtn.click();
    });
    
    await page.waitForTimeout(5000);
    
    const currentUrl = page.url();
    
    if (currentUrl.includes('/ai-tool/')) {
      isLoggedIn = true;
      console.log('✅ Login successful');
      return true;
    } else {
      throw new Error('Login failed - unexpected URL');
    }
    
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    isLoggedIn = false;
    return false;
  }
}

async function generateImage(prompt, modelName) {
  if (!isLoggedIn) {
    throw new Error('Not logged in');
  }
  
  console.log(`Generating with ${modelName}: ${prompt}`);
  
  await page.goto('https://dreamina.capcut.com/ai-tool/home/', { 
    waitUntil: 'networkidle2',
    timeout: 60000 
  });
  
  await page.waitForTimeout(3000);
  
  const promptInput = await page.waitForSelector('textarea, input[type="text"]', { timeout: 10000 });
  await promptInput.click();
  await promptInput.type(prompt);
  console.log('✅ Prompt entered');
  
  await page.waitForTimeout(1000);
  
  if (modelName !== 'default') {
    await page.evaluate((model) => {
      const elements = Array.from(document.querySelectorAll('div, button, span'));
      const modelSelector = elements.find(el => el.textContent.includes(model));
      if (modelSelector) modelSelector.click();
    }, modelName);
    
    await page.waitForTimeout(2000);
  }
  
  const generateClicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const generateBtn = buttons.find(btn => 
      btn.textContent.toLowerCase().includes('generate') ||
      btn.textContent.toLowerCase().includes('create')
    );
    if (generateBtn) {
      generateBtn.click();
      return true;
    }
    return false;
  });
  
  if (!generateClicked) {
    throw new Error('Could not find generate button');
  }
  
  console.log('Waiting for generation...');
  await page.waitForTimeout(15000);
  
  const imageUrl = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll('img'));
    const generatedImage = images.find(img => 
      img.src.includes('dreamina') || 
      img.src.includes('generated')
    );
    return generatedImage ? generatedImage.src : null;
  });
  
  if (imageUrl) {
    console.log('✅ Image generated');
    return imageUrl;
  } else {
    throw new Error('Could not extract image URL');
  }
}

app.get('/generate/nano-banana', async (req, res) => {
  const { prompt } = req.query;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt required' });
  }
  
  if (!isLoggedIn) {
    return res.status(503).json({ error: 'Server not ready' });
  }
  
  try {
    const imageUrl = await generateImage(prompt, 'Nano Banana');
    res.json({ 
      success: true, 
      model: 'Nano Banana',
      prompt: prompt,
      imageUrl: imageUrl 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Generation failed', 
      details: error.message 
    });
  }
});

app.get('/generate/image-4', async (req, res) => {
  const { prompt } = req.query;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt required' });
  }
  
  if (!isLoggedIn) {
    return res.status(503).json({ error: 'Server not ready' });
  }
  
  try {
    const imageUrl = await generateImage(prompt, 'Image 4.0');
    res.json({ 
      success: true, 
      model: 'Image 4.0',
      prompt: prompt,
      imageUrl: imageUrl 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Generation failed', 
      details: error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    loggedIn: isLoggedIn,
    message: isLoggedIn ? 'Ready' : 'Login required'
  });
});

async function startServer() {
  try {
    if (!process.env.DREAMINA_EMAIL || !process.env.DREAMINA_PASSWORD) {
      console.warn('\n⚠️  DREAMINA_EMAIL and DREAMINA_PASSWORD required');
      console.warn('⚠️  Add them in Secrets (Tools > Secrets)\n');
    } else {
      await initializeBrowser();
      await loginToDreamina();
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`\nEndpoints:`);
      console.log(`  GET /generate/nano-banana?prompt=YOUR_PROMPT`);
      console.log(`  GET /generate/image-4?prompt=YOUR_PROMPT`);
      console.log(`  GET /health\n`);
    });
  } catch (error) {
    console.error('Startup failed:', error.message);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Server running on port ${PORT} (login failed)\n`);
    });
  }
}

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  if (browser) await browser.close();
  process.exit(0);
});

startServer();
