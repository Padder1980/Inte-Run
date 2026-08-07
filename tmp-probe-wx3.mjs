import { chromium } from 'playwright-core';
const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const b = await chromium.launch({ headless: true, executablePath: EXE });
const ctx = await b.newContext({ viewport:{width:390,height:844}, permissions:['geolocation'], geolocation:{latitude:53.4808, longitude:-2.2426} });
await ctx.addInitScript(() => { try { localStorage.clear(); } catch(e){} });
const p = await ctx.newPage();
await p.goto('http://localhost:8731/index.html');
let clicked=false;
for (let t=0;t<=9000;t+=250){
  await p.waitForTimeout(250);
  const s = await p.evaluate(()=>{
    const w=document.querySelector('.welcome');
    const wVis = w ? getComputedStyle(w).display!=='none' && getComputedStyle(w).opacity!=='0' : false;
    const sp=document.querySelector('.splash');
    const spVis = sp ? getComputedStyle(sp).display!=='none' && getComputedStyle(sp).opacity!=='0' : false;
    const sq=document.getElementById('condSq');
    return {welcome:!!w, wVis, splash:!!sp, spVis, cond: sq?sq.innerText.replace(/\n/g,' | '):null};
  });
  if (!clicked && s.welcome && s.wVis) { const g = await p.$('#wbGo'); if (g) { await g.click(); clicked=true; console.log(t+'ms  >>> tapped Get started'); continue; } }
  console.log(t+'ms', JSON.stringify(s));
}
await b.close();
