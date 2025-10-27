require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

let browser = null;
let page = null;
let isLoggedIn = false;

// Helper function to replace deprecated page.waitForTimeout
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Parse Netscape format cookies from account.txt
function parseNetscapeCookies(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Cookie file not found: ${filePath}`);
  }

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const cookies = [];

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith('#') || line.trim() === '') continue;

    const parts = line.split('\t');
    if (parts.length < 7) continue;

    const [domain, flag, path, secure, expiration, name, value] = parts;

    // Handle #HttpOnly_ prefix
    const cleanDomain = domain.startsWith('#HttpOnly_') 
      ? domain.replace('#HttpOnly_', '') 
      : domain;

    cookies.push({
      name: name.trim(),
      value: value.trim(),
      domain: cleanDomain,
      path: path || '/',
      expires: parseInt(expiration) || -1,
      httpOnly: domain.startsWith('#HttpOnly_'),
      secure: secure.toUpperCase() === 'TRUE',
      sameSite: 'Lax'
    });
  }

  return cookies;
}

async function initializeBrowser() {
  console.log('Initializing browser...');
  
  const { execSync } = require('child_process');
  const fs = require('fs');
  let chromiumPath = null;
  
  const possiblePaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome'
  ];
  
  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      chromiumPath = path;
      console.log(`Found Chromium at: ${chromiumPath}`);
      break;
    }
  }
  
  if (!chromiumPath) {
    try {
      chromiumPath = execSync('which chromium').toString().trim();
      console.log(`Using system Chromium at: ${chromiumPath}`);
    } catch (e) {
      console.log('Using bundled Chromium from Puppeteer');
    }
  }
  
  const launchOptions = {
    headless: 'new',
    executablePath: chromiumPath || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ],
    timeout: 120000,
    protocolTimeout: 180000 // 3 minutes for slow-loading pages
  };
  
  let retries = 3;
  let lastError;
  
  while (retries > 0) {
    try {
      console.log(`Browser launch attempt ${4 - retries}/3...`);
      browser = await puppeteer.launch(launchOptions);
      page = await browser.newPage();
      
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Enhanced bot detection bypassing
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        
        // Override permissions
        Object.defineProperty(navigator, 'permissions', {
          get: () => ({
            query: () => Promise.resolve({ state: 'granted' })
          })
        });
        
        // Add languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en']
        });
        
        // Add plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });
        
        // Override chrome property
        window.chrome = {
          runtime: {}
        };
      });
      
      console.log('✅ Browser initialized successfully');
      return;
    } catch (error) {
      lastError = error;
      retries--;
      console.error(`❌ Browser launch failed (${3 - retries}/3): ${error.message}`);
      console.error(`Full error:`, error.stack);
      
      if (browser) {
        try { await browser.close(); } catch (e) {}
        browser = null;
      }
      
      if (retries > 0) {
        console.log(`Retrying in 5 seconds...`);
        await delay(5000);
      }
    }
  }
  
  throw new Error(`Failed to initialize browser after 3 attempts. Last error: ${lastError.message}`);
}

async function loginToDreamina() {
  console.log('Loading cookies from account.txt...');
  
  try {
    const cookieFilePath = path.join(__dirname, 'account.txt');
    
    // Parse cookies from account.txt
    const cookies = parseNetscapeCookies(cookieFilePath);
    console.log(`Loaded ${cookies.length} cookies from account.txt`);
    
    // Test network connectivity first
    console.log('Testing network connectivity to Dreamina...');
    try {
      await page.goto('https://dreamina.capcut.com/', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      console.log('✅ Network connectivity confirmed');
    } catch (connectError) {
      console.error('⚠️  Warning: Basic connectivity test failed:', connectError.message);
      console.error('This may indicate network blocking or DNS issues');
    }
    
    // Set cookies in the browser
    await page.setCookie(...cookies);
    console.log('✅ Cookies set in browser');
    
    // Navigate to Dreamina home page with retry logic
    console.log('Navigating to Dreamina...');
    let navigationSuccess = false;
    let retries = 3;
    
    while (retries > 0 && !navigationSuccess) {
      try {
        console.log(`Navigation attempt ${4 - retries}/3 to Dreamina...`);
        await page.goto('https://dreamina.capcut.com/ai-tool/home/', { 
          waitUntil: 'domcontentloaded',
          timeout: 120000 
        });
        navigationSuccess = true;
        console.log('✅ Navigation successful');
      } catch (navError) {
        retries--;
        console.error(`❌ Navigation attempt failed (${3 - retries}/3): ${navError.message}`);
        console.error(`Full navigation error:`, navError.stack);
        if (retries === 0) {
          throw new Error(`Failed to navigate after 3 attempts: ${navError.message}`);
        }
        console.log(`Waiting 5 seconds before retry...`);
        await delay(5000);
      }
    }
    
    // Wait for page to fully load with retry logic
    console.log('Waiting for page to load...');
    
    let loginStatus = null;
    let loginVerified = false;
    const maxLoginChecks = 5;
    
    for (let checkAttempt = 1; checkAttempt <= maxLoginChecks; checkAttempt++) {
      console.log(`Login verification attempt ${checkAttempt}/${maxLoginChecks}...`);
      await delay(5000); // Wait 5 seconds before each check
      
      const currentUrl = page.url();
      
      loginStatus = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const bodyHTML = document.body.innerHTML;
        const buttons = document.querySelectorAll('button');
        const inputs = document.querySelectorAll('input');
        const textareas = document.querySelectorAll('textarea');
        
        // Check for login indicators (negative - means NOT logged in)
        const hasLoginButton = Array.from(buttons).some(b => 
          b.textContent.toLowerCase().includes('log in') || 
          b.textContent.toLowerCase().includes('sign in') ||
          b.textContent.toLowerCase().includes('continue with')
        );
        
        // Check for logged-in indicators (positive - means logged in)
        const hasCreateButton = Array.from(buttons).some(b => 
          b.textContent.toLowerCase().includes('generate') || 
          b.textContent.toLowerCase().includes('create')
        );
        
        const hasPromptInput = Array.from([...inputs, ...textareas]).some(i => 
          i.placeholder && (
            i.placeholder.toLowerCase().includes('prompt') ||
            i.placeholder.toLowerCase().includes('describe') ||
            i.placeholder.toLowerCase().includes('imagine')
          )
        );
        
        // Check for navigation items indicating logged-in state
        const hasCreateNav = bodyText.includes('Create') || bodyText.includes('Explore');
        
        return {
          bodyLength: bodyText.length,
          bodyHTMLLength: bodyHTML.length,
          hasLoginButton,
          hasCreateButton,
          hasPromptInput,
          hasCreateNav,
          bodyPreview: bodyText.substring(0, 300),
          htmlPreview: bodyHTML.substring(0, 500)
        };
      });
      
      console.log(`Check ${checkAttempt}:`, JSON.stringify(loginStatus, null, 2));
      
      // Take screenshot on first check for debugging
      if (checkAttempt === 1) {
        try {
          await page.screenshot({ path: '/tmp/login-debug.png' });
          console.log('📸 Screenshot saved to /tmp/login-debug.png for debugging');
        } catch (screenshotErr) {
          console.log('Could not save screenshot:', screenshotErr.message);
        }
      }
      
      // Validate login: should NOT have login buttons
      if (currentUrl.includes('/login')) {
        throw new Error('Redirected to login page - cookies expired or invalid');
      }
      
      if (loginStatus.hasLoginButton) {
        throw new Error('Login UI detected - cookies may be expired. Please refresh your account.txt');
      }
      
      // Success conditions
      if (loginStatus.hasCreateButton || loginStatus.hasPromptInput) {
        isLoggedIn = true;
        console.log('✅ Login successful - creative tools detected');
        loginVerified = true;
        break;
      }
      
      // Check for navigation with HTML content loaded (more reliable than bodyLength)
      if (loginStatus.hasCreateNav && loginStatus.bodyHTMLLength > 10000) {
        isLoggedIn = true;
        console.log('✅ Login successful - navigation detected, content loaded');
        loginVerified = true;
        break;
      }
      
      if (loginStatus.bodyLength > 1000) {
        // Page has substantial content, likely logged in
        isLoggedIn = true;
        console.log('✅ Login successful - page loaded with substantial content');
        loginVerified = true;
        break;
      }
      
      if (checkAttempt < maxLoginChecks) {
        console.log('Content still loading, will retry...');
      }
    }
    
    if (!loginVerified) {
      throw new Error('Could not verify login status - page may not have loaded properly. Last check: ' + JSON.stringify(loginStatus));
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    console.error('Full login error:', error.stack);
    console.error('Please check: 1) account.txt cookies are fresh, 2) Dreamina website is accessible from this network');
    isLoggedIn = false;
    return false;
  }
}

async function generateImage(prompt, modelName) {
  if (!isLoggedIn) {
    throw new Error('Not logged in');
  }
  
  console.log(`Generating with ${modelName}: ${prompt}`);
  
  // NEW APPROACH: Always go directly to the generate page
  console.log('Step 1: Navigating directly to /ai-tool/generate page...');
  
  try {
    await page.goto('https://dreamina.capcut.com/ai-tool/generate', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    console.log('✅ Loaded generate page');
    await delay(3000); // Wait for page to fully render
  } catch (navError) {
    console.log('⚠️ Navigation failed:', navError.message);
    throw new Error('Unable to load generate page');
  }
  
  // Step 2: Track existing images BEFORE entering prompt (to detect new ones later)
  console.log('Step 2: Recording existing images on the page...');
  const existingImageUrls = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs
      .map(img => img.src)
      .filter(src => src && src.startsWith('http'));
  });
  console.log(`Found ${existingImageUrls.length} existing images to exclude`);
  
  // Step 3: Find and fill the prompt input
  console.log('Step 3: Entering prompt and submitting...');
  
  let promptFilled = null;
  const maxPromptRetries = 5;
  
  for (let attempt = 1; attempt <= maxPromptRetries; attempt++) {
    console.log(`Prompt input attempt ${attempt}/${maxPromptRetries}...`);
    
    promptFilled = await page.evaluate((promptText) => {
      // Find textarea with prompt placeholder
      const textareas = document.querySelectorAll('textarea');
      for (const el of textareas) {
        const placeholder = (el.placeholder || '').toLowerCase();
        if (placeholder.includes('describe') || 
            placeholder.includes('imagine') || 
            placeholder.includes('prompt')) {
          
          // Clear and set value
          el.value = '';
          el.focus();
          el.value = promptText;
          
          // Trigger all necessary events
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          
          return { success: true, element: 'textarea', placeholder: el.placeholder };
        }
      }
      
      // Fallback: any visible textarea
      for (const el of textareas) {
        if (el.offsetParent !== null) {
          el.value = '';
          el.focus();
          el.value = promptText;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true, element: 'textarea-fallback' };
        }
      }
      
      return { success: false };
    }, prompt);
    
    if (promptFilled.success) {
      console.log(`✅ Prompt entered successfully`);
      break;
    }
    
    if (attempt < maxPromptRetries) {
      console.log('Prompt input not found, waiting 2 seconds...');
      await delay(2000);
    }
  }
  
  if (!promptFilled || !promptFilled.success) {
    throw new Error(`Could not find prompt input after ${maxPromptRetries} attempts`);
  }
  
  await delay(1500); // Wait for input to be processed
  
  // Step 4: Submit the prompt using keyboard Enter
  console.log('Step 4: Submitting prompt with Enter key...');
  
  try {
    // Press Enter to submit (Ctrl+Enter or just Enter depending on the UI)
    await page.keyboard.press('Enter');
    console.log('✅ Pressed Enter to submit');
    await delay(2000);
  } catch (submitError) {
    console.log('⚠️ Enter key submission failed, will wait for generation anyway');
  }
  
  // Step 5: Wait for NEW generated images to appear
  console.log('Step 5: Waiting for NEW generated images to appear (max 30 seconds)...');
  console.log('Looking for 4 newly generated images...');
  
  let imageData = null;
  const maxWaitTime = 30; // 30 seconds max (Dreamina generates in 15-20s)
  const checkInterval = 2; // Check every 2 seconds
  let imagesFound = false;
  
  for (let elapsed = 0; elapsed < maxWaitTime; elapsed += checkInterval) {
    await delay(checkInterval * 1000);
    
    // Check for NEW generated images (exclude existing ones)
    const checkResult = await page.evaluate((promptText, existingUrls) => {
      const allImages = Array.from(document.querySelectorAll('img'));
      
      // Filter for NEW large content images IN THE TOP SECTION ONLY
      const newContentImages = allImages.filter(img => {
        const src = img.src || '';
        const rect = img.getBoundingClientRect();
        
        // Must be a valid HTTP URL and NOT in existing images
        if (!src || !src.startsWith('http')) return false;
        if (existingUrls.includes(src)) return false;
        
        // Exclude UI elements
        if (src.includes('icon') || src.includes('logo') || 
            src.includes('avatar') || src.includes('profile')) return false;
        
        // Must be large (generated images are typically 200x200+)
        if (rect.width < 180 || rect.height < 180) return false;
        
        // Must be visible
        if (rect.width === 0 || rect.height === 0) return false;
        
        // CRITICAL: Only count images in the TOP section (generated results area)
        // This excludes the 36 gallery images below
        if (rect.top > 600) return false;
        
        return true;
      });
      
      // Check for loading indicators (spinners, progress text)
      const bodyText = document.body.textContent || '';
      const isGenerating = bodyText.includes('Generating') || 
                          bodyText.includes('Loading') ||
                          bodyText.includes('%') ||
                          document.querySelector('[class*="loading"]') !== null ||
                          document.querySelector('[class*="spinner"]') !== null;
      
      return {
        newImageCount: newContentImages.length,
        isGenerating: isGenerating,
        totalImages: allImages.length
      };
    }, prompt, existingImageUrls);
    
    console.log(`[${elapsed + checkInterval}s] NEW images: ${checkResult.newImageCount}, Generating: ${checkResult.isGenerating}`);
    
    // If we have 4+ NEW images AND generation indicators are gone, we're done
    if (checkResult.newImageCount >= 4 && !checkResult.isGenerating) {
      console.log(`✅ Generation complete! Found ${checkResult.newImageCount} NEW images`);
      imagesFound = true;
      await delay(2000); // Wait a bit more for images to fully load
      break;
    }
  }
  
  if (!imagesFound) {
    console.log('⚠️ Timeout waiting for images, attempting to extract anyway...');
  }
  
  // Step 9: Extract ONLY the NEW generated image URLs
  console.log('Step 9: Extracting NEW generated image URLs...');
  
  imageData = await page.evaluate((promptText, existingUrls) => {
    const allImages = Array.from(document.querySelectorAll('img'));
    
    // Collect NEW large content images with their positions
    const newContentImages = allImages
      .map(img => {
        const src = img.src || '';
        const rect = img.getBoundingClientRect();
        return { img, src, rect };
      })
      .filter(data => {
        const { src, rect } = data;
        
        // Must be new (not in existing list)
        if (!src || !src.startsWith('http')) return false;
        if (existingUrls.includes(src)) return false;
        
        // Exclude UI elements
        if (src.includes('icon') || src.includes('logo') || 
            src.includes('avatar') || src.includes('profile')) return false;
        
        // Must be large and visible
        if (rect.width < 180 || rect.height < 180) return false;
        if (rect.width === 0 || rect.height === 0) return false;
        
        // CRITICAL: Only look at images in the TOP section of the page
        // Generated images appear at the top, gallery images are below
        // Limit to images in the top 600px of the viewport
        if (rect.top > 600) return false;
        
        return true;
      });
    
    // Sort by Y position (top to bottom), then X position (left to right)
    newContentImages.sort((a, b) => {
      const yDiff = a.rect.top - b.rect.top;
      if (Math.abs(yDiff) > 50) return yDiff; // Different rows
      return a.rect.left - b.rect.left; // Same row, sort left to right
    });
    
    // Group images by Y position to find images in the same row
    const rows = [];
    let currentRow = [];
    let lastY = -1000;
    
    for (const imgData of newContentImages) {
      if (Math.abs(imgData.rect.top - lastY) > 50) {
        // New row
        if (currentRow.length > 0) rows.push(currentRow);
        currentRow = [imgData];
        lastY = imgData.rect.top;
      } else {
        // Same row
        currentRow.push(imgData);
      }
    }
    if (currentRow.length > 0) rows.push(currentRow);
    
    // Find the first row with 4 images (the generated set)
    let targetImages = [];
    for (const row of rows) {
      if (row.length === 4) {
        targetImages = row;
        break;
      }
    }
    
    // Fallback: if no row has exactly 4, take the first 4 NEW images
    if (targetImages.length === 0 && newContentImages.length >= 4) {
      targetImages = newContentImages.slice(0, 4);
    }
    
    const urls = targetImages.map(data => data.src);
    
    return {
      totalImages: allImages.length,
      newImageCount: newContentImages.length,
      rowCount: rows.length,
      urls: urls,
      foundInRow: targetImages.length === 4
    };
  }, prompt, existingImageUrls);
  
  console.log(`Found ${imageData.newImageCount} NEW images in ${imageData.rowCount} rows`);
  console.log(`Extracted ${imageData.urls.length} image URLs (found in row: ${imageData.foundInRow})`);
  
  if (imageData.urls.length === 0) {
    throw new Error('No NEW generated images found - generation may have failed');
  }
  
  // Step 10: Return the image URLs
  console.log(`Step 10: Returning ${imageData.urls.length} NEW image URLs...`);
  const images = imageData.urls.map((url, i) => ({
    url: url,
    index: i + 1
  }));
  
  console.log(`✅ Successfully extracted ${images.length} NEW generated images`);
  images.forEach((img, i) => {
    console.log(`  Image ${i + 1}: ${img.url.substring(0, 100)}...`);
  });
  
  return images;

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
    const images = await generateImage(prompt, 'Nano Banana');
    console.log(`📤 Returning ${images.length} images to client`);
    res.json({ 
      success: true, 
      model: 'Nano Banana',
      prompt: prompt,
      count: images.length,
      images: images
    });
  } catch (error) {
    console.error(`❌ Generation error for prompt "${prompt}":`, error.message);
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
    const images = await generateImage(prompt, 'Image 4.0');
    console.log(`📤 Returning ${images.length} images to client`);
    res.json({ 
      success: true, 
      model: 'Image 4.0',
      prompt: prompt,
      count: images.length,
      images: images
    });
  } catch (error) {
    console.error(`❌ Generation error for prompt "${prompt}":`, error.message);
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
  // START SERVER IMMEDIATELY - don't block on browser initialization
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`\nEndpoints:`);
    console.log(`  GET /generate/nano-banana?prompt=YOUR_PROMPT`);
    console.log(`  GET /generate/image-4?prompt=YOUR_PROMPT`);
    console.log(`  GET /health\n`);
  });
  
  // Initialize browser and login in the background (non-blocking)
  const cookieFilePath = path.join(__dirname, 'account.txt');
  
  if (!fs.existsSync(cookieFilePath)) {
    console.warn('\n⚠️  account.txt not found!');
    console.warn('⚠️  Create account.txt in the root directory with Netscape format cookies\n');
    return;
  }
  
  // Run browser initialization asynchronously
  (async () => {
    try {
      await initializeBrowser();
      await loginToDreamina();
      console.log('✅ Background initialization complete - ready to generate images');
    } catch (error) {
      console.error('❌ Background initialization failed:', error.message);
      console.error('Full error:', error.stack);
      console.error('Server will continue running but image generation will not work');
    }
  })();
}

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  if (browser) await browser.close();
  process.exit(0);
});

startServer();
