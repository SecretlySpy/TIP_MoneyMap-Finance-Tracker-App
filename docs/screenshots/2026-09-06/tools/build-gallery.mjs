import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const directory=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const cards=manifest.captures.map(c=>`<article data-search="${escape(`${c.title} ${c.screen}`.toLowerCase())}">
  <h2>${escape(c.title)}</h2>
  <p class="meta">${c.width} × ${c.height} px${c.sample?' · Sample finance data':''}${c.importSample?' · Sample CSV':''}${c.stitched?' · Joined native frames':''}</p>
  <div class="links"><a href="${escape(c.file)}" target="_blank" rel="noopener" aria-label="Open ${escape(c.title)} at full size">Open full size ↗</a><a href="${escape(c.file)}" download aria-label="Download ${escape(c.title)} PNG">Download PNG</a></div>
  <a href="${escape(c.file)}" target="_blank" rel="noopener" tabindex="-1"><img src="${escape(c.file)}" width="${c.width}" height="${c.height}" alt="Full-page native Android screenshot: ${escape(c.title)}" loading="lazy"></a>
</article>`).join('\n');
const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MoneyMap — Full-page screenshots</title>
<style>
:root{color-scheme:light;--ink:#182f2a;--muted:#50635d;--green:#075e4e;--line:#cbdad4;--paper:#fff;--bg:#eef4f1}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,sans-serif}header,main,footer{max-width:1500px;margin:auto;padding:28px}header{padding-top:42px}h1{font-size:clamp(1.8rem,4vw,3rem);line-height:1.15;margin:0 0 14px}h2{font-size:1.05rem;margin:0}p{max-width:78ch}.eyebrow{color:var(--green);font-weight:700;letter-spacing:.06em;font-size:.8rem;text-transform:uppercase}.meta,footer{color:var(--muted);font-size:.86rem}.actions,.links{display:flex;gap:16px;flex-wrap:wrap;align-items:center}a{color:var(--green);text-underline-offset:3px}a:focus-visible,input:focus-visible{outline:3px solid #a14409;outline-offset:3px}.primary{display:inline-flex;align-items:center;min-height:44px;background:var(--green);color:white;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:650}label{display:block;font-weight:650;margin:26px 0 8px}input{width:min(100%,540px);font:inherit;padding:12px 14px;border:1px solid var(--line);border-radius:8px;background:white;color:var(--ink)}#count{margin:10px 0 0}.gallery{columns:3 290px;column-gap:24px;padding-top:0}article{break-inside:avoid;margin:0 0 24px;padding:16px;background:var(--paper);border:1px solid var(--line);border-radius:12px}article .meta{margin:6px 0 8px}.links{font-size:.85rem;margin-bottom:14px}.links a{min-height:44px;display:flex;align-items:center}img{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:3px}article[hidden]{display:none}footer{border-top:1px solid var(--line);margin-top:20px}@media(max-width:600px){header,main,footer{padding:20px}.gallery{padding-top:0;columns:1}.actions{gap:12px}}
</style></head><body>
<header><p class="eyebrow">MoneyMap · Native Android · 6 September 2026</p><h1>Every page, from top to bottom.</h1>
<p>${manifest.captures.length} screenshots cover all 14 registered screens, with separate entry modes, empty and populated pages, import steps, and embedded forms. Each image retains its entire captured scrolling height.</p>
<p class="meta">1080 px wide · approximately 411 dp · light appearance · local Android development build. Financial examples and CSV previews use temporary sample data.</p>
<div class="actions"><a class="primary" href="../moneymap-full-page-2026-09-06.zip" download>Download all screenshots (ZIP)</a><a href="README.md">Capture notes</a><a href="manifest.json">Measurement evidence</a></div>
<label for="filter">Find a page or state</label><input id="filter" type="search" placeholder="Dashboard, income, import, recurring…" autocomplete="off"><p class="meta" id="count" role="status" aria-live="polite">Showing ${manifest.captures.length} screenshots</p></header>
<main class="gallery" id="gallery">${cards}</main>
<footer>PNG files contain the native app rendering. Most pages fit one expanded native frame; longer pages are joined using measured scroll offsets and verified pixel overlap. System bars appear once. <a href="README.md">Read capture scope and limitations</a>.</footer>
<script>
const filter=document.querySelector('#filter');const articles=[...document.querySelectorAll('article')];filter.addEventListener('input',()=>{const term=filter.value.trim().toLowerCase();let visible=0;for(const card of articles){card.hidden=!card.dataset.search.includes(term);if(!card.hidden)visible++;}document.querySelector('#count').textContent='Showing '+visible+' of '+articles.length+' screenshots';});
</script></body></html>\n`;
fs.writeFileSync(path.join(directory,'index.html'),html);
console.log(`Built gallery with ${manifest.captures.length} full-height images`);
