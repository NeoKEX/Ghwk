require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

let browser = null;
let page = null;
let isLoggedIn = false;

async function initializeBrowser() {
  console.log('Initializing Puppeteer browser...');
  
  try {
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--window-size=1920,1080'
      ],
      dumpio: false,
      timeout: 60000
    };
    
    const { execSync } = require('child_process');
    let chromiumPath = null;
    
    try {
      chromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH || execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null').toString().trim();
      if (chromiumPath) {
        console.log(`Using Chromium at: ${chromiumPath}`);
        launchOptions.executablePath = chromiumPath;
      }
    } catch (e) {
      console.log('Using bundled Chromium from Puppeteer');
    }
    
    browser = await puppeteer.launch(launchOptions);
    
    page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(30000);
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log('Browser initialized successfully');
  } catch (error) {
    console.error('Browser initialization error:', error.message);
    throw error;
  }
}

async function loginToDreamina() {
  console.log('Attempting to login to Dreamina...');
  
  try {
    await page.goto('https://dreamina.capcut.com/ai-tool/home/', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    }).catch(err => {
      console.log('Note: Navigation warning (non-critical):', err.message);
    });
    
    console.log('Navigated to Dreamina homepage');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('Trying to find and click login button...');
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
      const loginButtonSelectors = [
        '[class*="login"]',
        '[class*="sign-in"]'
      ];
      
      for (const selector of loginButtonSelectors) {
        try {
          await page.click(selector, { timeout: 5000 });
          console.log(`Clicked login button with selector: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email" i]'
    ];
    
    let emailInput = null;
    for (const selector of emailSelectors) {
      try {
        emailInput = await page.$(selector);
        if (emailInput) {
          console.log(`Found email input with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!emailInput) {
      console.log('Looking for email login option...');
      await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('button, div, span'));
        const emailOption = elements.find(el => 
          el.textContent.toLowerCase().includes('email') ||
          el.textContent.toLowerCase().includes('continue with email')
        );
        if (emailOption) emailOption.click();
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      for (const selector of emailSelectors) {
        try {
          emailInput = await page.$(selector);
          if (emailInput) break;
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!emailInput) {
      throw new Error('Could not find email input field');
    }
    
    await page.type('input[type="email"], input[name="email"]', process.env.DREAMINA_EMAIL);
    console.log('Entered email address');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[placeholder*="password" i]'
    ];
    
    let passwordInput = null;
    for (const selector of passwordSelectors) {
      try {
        passwordInput = await page.$(selector);
        if (passwordInput) {
          console.log(`Found password input with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!passwordInput) {
      throw new Error('Could not find password input field');
    }
    
    await page.type('input[type="password"]', process.env.DREAMINA_PASSWORD);
    console.log('Entered password');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const submitSelectors = [
      'button[type="submit"]',
      '[class*="submit"]'
    ];
    
    let submitClicked = false;
    for (const selector of submitSelectors) {
      try {
        await page.click(selector, { timeout: 3000 });
        submitClicked = true;
        console.log(`Clicked submit button with selector: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!submitClicked) {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const submitBtn = buttons.find(btn => 
          btn.textContent.toLowerCase().includes('log in') ||
          btn.textContent.toLowerCase().includes('sign in') ||
          btn.textContent.toLowerCase().includes('continue')
        );
        if (submitBtn) submitBtn.click();
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const currentUrl = page.url();
    console.log(`Current URL after login attempt: ${currentUrl}`);
    
    if (currentUrl.includes('/ai-tool/') || currentUrl.includes('/home')) {
      isLoggedIn = true;
      console.log('✅ LOGIN SUCCESSFUL - Dreamina session established');
      return true;
    } else {
      console.log('⚠️  Login may have failed - unexpected URL');
      isLoggedIn = false;
      return false;
    }
    
  } catch (error) {
    console.error('❌ LOGIN FAILED:', error.message);
    isLoggedIn = false;
    return false;
  }
}

async function generateImageWithModel(prompt, modelName) {
  if (!isLoggedIn) {
    throw new Error('Not logged in to Dreamina. Please restart the server.');
  }
  
  console.log(`Generating image with ${modelName} model...`);
  console.log(`Prompt: ${prompt}`);
  
  try {
    await page.goto('https://dreamina.capcut.com/ai-tool/home/', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const promptSelectors = [
      'textarea[placeholder*="prompt" i]',
      'textarea[placeholder*="Describe" i]',
      'input[placeholder*="prompt" i]',
      'textarea',
      'input[type="text"]'
    ];
    
    let promptInput = null;
    for (const selector of promptSelectors) {
      try {
        promptInput = await page.$(selector);
        if (promptInput) {
          console.log(`Found prompt input with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!promptInput) {
      throw new Error('Could not find prompt input field');
    }
    
    await promptInput.click();
    await page.keyboard.type(prompt);
    console.log('Entered prompt');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (modelName !== 'default') {
      console.log(`Attempting to select ${modelName} model...`);
      
      await page.evaluate((model) => {
        const elements = Array.from(document.querySelectorAll('div, button, span'));
        const modelSelector = elements.find(el => 
          el.textContent.includes(model) ||
          el.textContent.includes('Image 4.0') ||
          el.textContent.includes('Nano Banana')
        );
        if (modelSelector) modelSelector.click();
      }, modelName);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('Trying to find and click generate button...');
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
      const generateSelectors = [
        '[class*="generate"]',
        '[class*="create"]'
      ];
      
      for (const selector of generateSelectors) {
        try {
          await page.click(selector, { timeout: 3000 });
          console.log(`Clicked generate button with selector: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }
    }
    
    console.log('Waiting for image generation...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    const imageUrl = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      const generatedImage = images.find(img => 
        img.src.includes('dreamina') || 
        img.src.includes('generated') ||
        img.parentElement?.classList?.toString().includes('result')
      );
      return generatedImage ? generatedImage.src : null;
    });
    
    if (imageUrl) {
      console.log('✅ Image generated successfully');
      return imageUrl;
    } else {
      throw new Error('Could not extract generated image URL');
    }
    
  } catch (error) {
    console.error('Image generation error:', error.message);
    throw error;
  }
}

app.get('/generate/nano-banana', async (req, res) => {
  const { prompt } = req.query;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Please provide a prompt query parameter' });
  }
  
  if (!isLoggedIn) {
    return res.status(503).json({ error: 'Server not ready. Dreamina login in progress or failed.' });
  }
  
  try {
    const imageUrl = await generateImageWithModel(prompt, 'Nano Banana');
    res.json({ 
      success: true, 
      model: 'Nano Banana',
      prompt: prompt,
      imageUrl: imageUrl 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Image generation failed', 
      details: error.message 
    });
  }
});

app.get('/generate/image-4', async (req, res) => {
  const { prompt } = req.query;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Please provide a prompt query parameter' });
  }
  
  if (!isLoggedIn) {
    return res.status(503).json({ error: 'Server not ready. Dreamina login in progress or failed.' });
  }
  
  try {
    const imageUrl = await generateImageWithModel(prompt, 'Image 4.0');
    res.json({ 
      success: true, 
      model: 'Image 4.0',
      prompt: prompt,
      imageUrl: imageUrl 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Image generation failed', 
      details: error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    loggedIn: isLoggedIn,
    message: isLoggedIn ? 'Ready to generate images' : 'Login in progress or failed'
  });
});

async function startServer() {
  try {
    if (!process.env.DREAMINA_EMAIL || !process.env.DREAMINA_PASSWORD) {
      console.warn('\n⚠️  WARNING: DREAMINA_EMAIL and/or DREAMINA_PASSWORD not configured');
      console.warn('⚠️  Please add these secrets in the Secrets tab (Tools > Secrets)');
      console.warn('⚠️  Server will start but image generation will not work until credentials are added\n');
    } else {
      await initializeBrowser();
      await loginToDreamina();
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Server running on http://0.0.0.0:${PORT}`);
      console.log(`\nAvailable endpoints:`);
      console.log(`  GET /generate/nano-banana?prompt=YOUR_PROMPT`);
      console.log(`  GET /generate/image-4?prompt=YOUR_PROMPT`);
      console.log(`  GET /health\n`);
      if (!process.env.DREAMINA_EMAIL || !process.env.DREAMINA_PASSWORD) {
        console.log(`⚠️  Add DREAMINA_EMAIL and DREAMINA_PASSWORD in Secrets to enable image generation\n`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Server running on http://0.0.0.0:${PORT} (login failed)`);
      console.log(`\n⚠️  Dreamina login failed. Check credentials and restart.\n`);
    });
  }
}

process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

startServer();
