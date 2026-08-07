import { chromium } from 'playwright-core';

const b = await chromium.launch({ headless: true, executablePath: process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: [] }); // geolocation NOT granted
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:8731/index.html');
await p.evaluate(() => { localStorage.clear(); });
await p.reload();
await p.waitForTimeout(1200);
// dismiss welcome
const go = await p.$('#wbGo');
console.log('welcome present:', !!go);
if (go) { await go.click(); }
await p.waitForTimeout(3500);

const dump = await p.evaluate(() => {
  const sq = document.getElementById('condSq');
  return {
    tab: document.body.innerText.slice(0,0),
    condSquare: sq ? sq.innerText : null,
    condHTMLhasLive: sq ? /live/.test(sq.innerHTML) : null,
    feelSq: document.getElementById('feelSq')?.innerText || null,
    banner: document.getElementById('setupBanner')?.innerText || null,
    wxState: (typeof state !== 'undefined') ? { weather: state.weather, wx: state.wx } : 'no state',
  };
});
console.log(JSON.stringify(dump, null, 2));
console.log('pageerrors:', errs);
await b.close();
