import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); // { routes:[{pts,color,label}], wall: 0|1|2|3, out, clip }
const A = 'E:/Github Repo/feudrion/client/public/assets/viva/';
const html = `<html><body style="margin:0"><canvas id=c width=1536 height=1024></canvas><script>
const cfg=${JSON.stringify(cfg)};
const g=new Image(); g.src='${pathToFileURL(A + 'city_ground_open.png').href}';
const w=new Image(); if(cfg.wall) w.src='${pathToFileURL(A + 'wall_stage_').href}'+cfg.wall+'.png';
Promise.all([g.decode(), cfg.wall? w.decode(): Promise.resolve()]).then(()=>{
 const c=document.getElementById('c').getContext('2d'); c.drawImage(g,0,0); if(cfg.wall) c.drawImage(w,0,0);
 if(cfg.grid){c.lineWidth=1;c.font='11px sans-serif';for(let x=0;x<1536;x+=cfg.grid){c.strokeStyle='rgba(0,255,255,.5)';c.beginPath();c.moveTo(x,0);c.lineTo(x,1024);c.stroke();c.fillStyle='#0ff';c.fillText(x,x+2,cfg.clip?cfg.clip.y+10:10)}for(let y=0;y<1024;y+=cfg.grid){c.strokeStyle='rgba(0,255,255,.5)';c.beginPath();c.moveTo(0,y);c.lineTo(1536,y);c.stroke();c.fillStyle='#0ff';c.fillText(y,(cfg.clip?cfg.clip.x:0)+2,y-2)}}
 for(const r of cfg.routes){ c.strokeStyle=r.color; c.lineWidth=3; c.beginPath(); r.pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y)); c.stroke(); c.fillStyle=r.color; r.pts.forEach(([x,y],i)=>{c.beginPath();c.arc(x,y,5,0,7);c.fill(); c.fillStyle='#fff'; c.font='bold 13px sans-serif'; c.fillText(i,x+7,y-6); c.fillStyle=r.color;}); }
 document.title='ok';
});</script></body></html>`;
const f = process.cwd() + '/routes.html';
fs.writeFileSync(f, html);
const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
const p = await b.newPage();
await p.setViewport({ width: 1536, height: 1024, deviceScaleFactor: cfg.scale || (cfg.clip ? 2 : 1) });
await p.goto(pathToFileURL(f).href);
await p.waitForFunction('document.title==="ok"', { timeout: 20000 });
await p.screenshot({ path: cfg.out, clip: cfg.clip });
await p.close(); b.disconnect(); console.log('ok');
