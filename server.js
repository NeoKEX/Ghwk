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
  
  // Check current page location
  const currentUrl = page.url();
  const isOnHomePage = currentUrl.includes('/ai-tool/home');
  const isOnGeneratePage = currentUrl.includes('/ai-tool/generate');
  
  // OPTIMIZATION: If we're on generate or home page, just reuse it (no navigation needed!)
  if (isOnGeneratePage || isOnHomePage) {
    console.log(`✅ Already on ${isOnGeneratePage ? 'generate' : 'home'} page, reusing (no navigation)`);
    // Page is ready to use, no navigation needed
  } else {
    // We're on a different page - need to navigate to home
    console.log('Step 1: Navigating to /ai-tool/home page...');
    try {
      await page.goto('https://dreamina.capcut.com/ai-tool/home', { 
        waitUntil: 'domcontentloaded',
        timeout: 45000 
      });
      console.log('✅ Loaded home page');
      await delay(3000);
    } catch (navError) {
      console.log('Navigation to home failed:', navError.message);
      // Try one more time with networkidle2
      console.log('Retrying with networkidle2...');
      try {
        await page.goto('https://dreamina.capcut.com/ai-tool/home', { 
          waitUntil: 'networkidle2',
          timeout: 45000 
        });
        console.log('✅ Loaded home page (retry successful)');
        await delay(3000);
      } catch (retryError) {
        console.log('Retry failed:', retryError.message);
        throw new Error('Unable to load home page after 2 attempts');
      }
    }
  }
  
  // Step 2: Find and fill the prompt input
  console.log('Step 2: Entering prompt...');
  
  let promptFilled = null;
  const maxPromptRetries = 8;
  
  for (let attempt = 1; attempt <= maxPromptRetries; attempt++) {
    console.log(`Prompt input attempt ${attempt}/${maxPromptRetries}...`);
    
    // Debug: check what's on the page
    const pageInfo = await page.evaluate(() => {
      const textareas = document.querySelectorAll('textarea');
      const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
      
      return {
        textareaCount: textareas.length,
        textareaInfo: Array.from(textareas).map(t => ({
          placeholder: t.placeholder || 'none',
          visible: t.offsetParent !== null,
          value: t.value
        })),
        inputCount: inputs.length,
        pageLoaded: document.readyState
      };
    });
    
    console.log(`  Page info:`, JSON.stringify(pageInfo, null, 2));
    
    promptFilled = await page.evaluate((promptText) => {
      // Strategy 1: Look for textarea with "Describe the image you're imagining" placeholder
      const textareas = document.querySelectorAll('textarea');
      for (const el of textareas) {
        const placeholder = (el.placeholder || '').toLowerCase();
        if (placeholder.includes('describe') || 
            placeholder.includes('imagine') || 
            placeholder.includes('prompt')) {
          el.value = promptText;
          el.focus();
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
          return { success: true, method: 'textarea-with-placeholder', placeholder: el.placeholder };
        }
      }
      
      // Strategy 2: Look for any visible textarea (first one)
      for (const el of textareas) {
        if (el.offsetParent !== null) {
          el.value = promptText;
          el.focus();
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
          return { success: true, method: 'first-visible-textarea' };
        }
      }
      
      // Strategy 3: Look for contenteditable div
      const editableDivs = document.querySelectorAll('[contenteditable="true"]');
      for (const el of editableDivs) {
        if (el.offsetParent !== null) {
          el.textContent = promptText;
          el.focus();
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return { success: true, method: 'contenteditable' };
        }
      }
      
      return { success: false };
    }, prompt);
    
    if (promptFilled.success) {
      console.log(`✅ Prompt entered using ${promptFilled.method}`);
      break;
    }
    
    if (attempt < maxPromptRetries) {
      console.log('Prompt input not found, waiting 3 seconds...');
      await delay(3000);
    }
  }
  
  if (!promptFilled || !promptFilled.success) {
    throw new Error(`Could not find prompt input after ${maxPromptRetries} attempts`);
  }
  
  await delay(1000);
  
  // Step 4: Select the model
  console.log(`Step 4: Selecting model ${modelName}...`);
  try {
    const modelSelected = await page.evaluate((model) => {
      // Find and click on model selector dropdown (shows current model like "AI Image" or "Image 4.0")
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
      
      for (const btn of buttons) {
        const text = btn.textContent || '';
        // Look for model selector - it shows the current model name
        if (text.includes('AI Image') || text.includes('Image 4') || text.includes('Nano Banana') ||
            text.includes('Image 3') || text.includes('Image 2')) {
          btn.click();
          return { clicked: true };
        }
      }
      return { clicked: false };
    }, modelName);
    
    if (modelSelected.clicked) {
      console.log('✅ Opened model dropdown');
      await delay(1500);
      
      // Select the specific model from the dropdown
      const modelClicked = await page.evaluate((model) => {
        const options = Array.from(document.querySelectorAll('div, button, li'));
        for (const opt of options) {
          const text = opt.textContent || '';
          if ((model.includes('Nano') && text.includes('Nano Banana')) ||
              (model.includes('4') && text.includes('Image 4.0'))) {
            opt.click();
            return true;
          }
        }
        return false;
      }, modelName);
      
      if (modelClicked) {
        console.log(`✅ Selected model: ${modelName}`);
        await delay(2000);
      } else {
        console.log('⚠️ Could not select specific model, using default');
      }
    } else {
      console.log('⚠️ Model dropdown not found, using default model');
    }
  } catch (modelError) {
    console.log('⚠️ Model selection failed, using default:', modelError.message);
  }
  
  // Step 5: Click the generate button (arrow icon next to "0/image")
  console.log('Step 5: Clicking generate button...');
  let generateClicked = false;
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`Generate button click attempt ${attempt}/3...`);
    
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      
      // Strategy 1: Look for button with arrow icon (send/generate button)
      for (const btn of buttons) {
        const svg = btn.querySelector('svg');
        const rect = btn.getBoundingClientRect();
        
        // The generate button is typically an icon button on the right side
        if (svg && rect.width > 20 && rect.width < 100 && btn.offsetParent !== null) {
          // Check if it's positioned to the right (send button)
          const isRightAligned = rect.right > window.innerWidth * 0.5;
          if (isRightAligned) {
            btn.click();
            return { success: true, method: 'arrow-icon' };
          }
        }
      }
      
      // Strategy 2: Look for button near "0/image" text
      for (const btn of buttons) {
        const parent = btn.parentElement;
        if (!parent) continue;
        
        const nearbyText = parent.textContent || '';
        if (nearbyText.includes('/image') || nearbyText.includes('0/')) {
          btn.click();
          return { success: true, method: 'near-counter' };
        }
      }
      
      // Strategy 3: Find the upload/send button icon (usually the rightmost icon button in the prompt area)
      const iconButtons = buttons.filter(btn => {
        const svg = btn.querySelector('svg');
        const rect = btn.getBoundingClientRect();
        return svg && rect.width > 20 && rect.width < 80 && btn.offsetParent !== null;
      });
      
      if (iconButtons.length > 0) {
        // Sort by X position (rightmost first)
        iconButtons.sort((a, b) => {
          return b.getBoundingClientRect().right - a.getBoundingClientRect().right;
        });
        
        iconButtons[0].click();
        return { success: true, method: 'rightmost-icon' };
      }
      
      return { success: false };
    });
    
    if (clicked.success) {
      console.log(`✅ Generate button clicked using ${clicked.method}`);
      generateClicked = true;
      break;
    }
    
    if (attempt < 3) {
      console.log('Generate button not found, waiting and retrying...');
      await delay(2000);
    }
  }
  
  if (!generateClicked) {
    throw new Error('Could not find generate button after 3 attempts');
  }
  
  // Step 6: Wait for navigation to /ai-tool/generate page
  console.log('Step 6: Waiting for navigation to /ai-tool/generate...');
  
  // Wait for URL to change to /ai-tool/generate (with retries)
  let navigated = false;
  const maxNavWait = 30; // 30 seconds max
  
  for (let i = 0; i < maxNavWait; i++) {
    await delay(1000);
    const currentUrl = page.url();
    
    if (currentUrl.includes('/ai-tool/generate')) {
      console.log(`✅ Navigated to generate page after ${i + 1} seconds`);
      navigated = true;
      break;
    }
    
    if (i % 5 === 0 && i > 0) {
      console.log(`[${i}s] Still waiting for navigation... Current: ${currentUrl}`);
    }
  }
  
  if (!navigated) {
    throw new Error('Failed to navigate to generation page - generation may not have started');
  }
  
  await delay(3000); // Wait for page to settle and generation to start
  
  // Step 7: Track existing images BEFORE waiting (to identify NEW images)
  console.log('Step 7: Recording existing images before generation...');
  const existingImageUrls = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs
      .map(img => img.src)
      .filter(src => src && src.startsWith('http'));
  });
  console.log(`Found ${existingImageUrls.length} existing images to exclude`);
  
  // Step 8: Wait for NEW generated images to appear
  console.log('Step 8: Waiting for NEW generated images to appear (max 60 seconds)...');
  console.log('Looking for 4 newly generated images...');
  
  let imageData = null;
  const maxWaitTime = 60; // 60 seconds max (Dreamina generates in 30-40s)
  const checkInterval = 3; // Check every 3 seconds
  let imagesFound = false;
  
  for (let elapsed = 0; elapsed < maxWaitTime; elapsed += checkInterval) {
    await delay(checkInterval * 1000);
    
    // Check for NEW generated images (exclude existing ones)
    const checkResult = await page.evaluate((promptText, existingUrls) => {
      const allImages = Array.from(document.querySelectorAll('img'));
      
      // Filter for NEW large content images
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
