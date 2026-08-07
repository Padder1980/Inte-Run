import { chromium } from 'playwright-core';
const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const b = await chromium.launch({ headless: true, executablePath: EXE });
async function run(label, opts){
  const ctx = await b.newContext(Object.assign({viewport:{width:390,height:844}}, opts));
  await ctx.addInitScript(()=>{ try{localStorage.clear();}catch(e){} });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8731/index.html');
  await p.waitForSelector('#welcomeGo', {timeout:8000});
  const tSample = await p.evaluate(()=>document.getElementById('condSq')?.innerText.replace(/\n/g,' | '));
  await p.click('#welcomeGo');
  await p.waitForTimeout(1500);
  const after = await p.evaluate(()=>({
    screen: document.querySelector('.view-title, h1, .setup-h')?.innerText || null,
    cond: document.getElementById('condSq')?.innerText.replace(/\n/g,' | ') || null,
    welcomeGone: !document.querySelector('.welcome') || getComputedStyle(document.querySelector('.welcome')).display==='none',
    bodyTop: document.getElementById('view')?.innerText.slice(0,180)
  }));
  console.log('=== '+label+' ===');
  console.log('behind welcome at t0:', tSample);
  console.log(JSON.stringify(after,null,2));
  await p.screenshot({path:'tmp-after-'+label+'.png'});
  await ctx.close();
}
await run('granted', {permissions:['geolocation'], geolocation:{latitude:53.4808,longitude:-2.2426}});
await run('denied', {permissions:[]});
await b.close();
