import { chromium } from 'playwright-core';
const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const b = await chromium.launch({ headless: true, executablePath: EXE });

async function run(label, opts) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 390, height: 844 } }, opts));
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch(e){} });
  const p = await ctx.newPage();
  const net = [];
  p.on('request', r => { if (/open-meteo/.test(r.url())) net.push(r.url()); });
  await p.goto('http://localhost:8731/index.html');
  await p.waitForTimeout(1500);
  const welcome = await p.$('#wbGo');
  const welcomeText = welcome ? await p.evaluate(() => document.querySelector('.welcome')?.innerText || '') : null;
  if (welcome) await welcome.click();
  await p.waitForTimeout(5000);
  const d = await p.evaluate(() => {
    const sq = document.getElementById('condSq');
    const r = sq && sq.getBoundingClientRect();
    return {
      cond: sq ? sq.innerText : null,
      hasLiveWord: sq ? /·\s*live/.test(sq.innerText) : null,
      topPx: r ? Math.round(r.top) : null,
      wx: (typeof state!=='undefined') ? state.wx : 'n/a',
      scrollY: window.scrollY, viewScroll: document.getElementById('view')?.scrollTop
    };
  });
  console.log('=== ' + label + ' ===');
  console.log('welcome shown:', !!welcome, welcomeText ? JSON.stringify(welcomeText.slice(0,160)) : '');
  console.log(JSON.stringify(d, null, 2));
  console.log('open-meteo requests:', net);
  await p.screenshot({ path: 'tmp-shot-' + label + '.png', fullPage: false });
  await ctx.close();
}

await run('denied', { permissions: [] });
await run('granted', { permissions: ['geolocation'], geolocation: { latitude: 53.4808, longitude: -2.2426 } }); // Manchester
await b.close();
