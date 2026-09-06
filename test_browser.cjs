const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('response', response => {
      if (!response.ok()) {
        console.log('PAGE RESP ERR:', response.url(), response.status());
      }
    });
    
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });
    
    console.log('Page loaded successfully');
    await browser.close();
  } catch (e) {
    console.error('PUPPETEER ERROR:', e);
  }
})();
