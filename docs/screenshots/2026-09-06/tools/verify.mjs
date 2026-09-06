import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const directory=fileURLToPath(new URL('../',import.meta.url));
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const sharp=createRequire(path.join(root,'package.json'))('sharp');
const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
const source=fs.readFileSync(path.join(root,'src/navigation/RootNavigator.jsx'),'utf8');
const registered=new Map([...source.matchAll(/<\w+\.Screen name="([^"]+)" component=\{(\w+Screen)\}/g)].map(m=>[m[1],m[2]]));
const captured=new Set(manifest.captures.map(c=>c.screen));
const requireCheck=(condition,message)=>{if(!condition)throw new Error(message);};
for(const name of registered.keys())requireCheck(captured.has(name),`Uncaptured route: ${name}`);
const reports=[];
for(const capture of manifest.captures) {
  const filename=path.join(directory,capture.file);
  const buffer=fs.readFileSync(filename);
  const image=sharp(buffer);
  const metadata=await image.metadata();
  requireCheck(metadata.format==='png'&&metadata.width===1080&&metadata.height===capture.height,`Incorrect PNG dimensions: ${capture.slug}`);
  await image.stats(); // Decode the complete pixel stream, including the final rows.
  requireCheck(capture.verticalOverflowDp<=0.75,`Uncaptured vertical content: ${capture.slug}`);
  for(const m of capture.atEnd.filter(m=>!m.horizontal)) {
    requireCheck(m.content.py+m.content.h-m.viewport.py-m.viewport.h<=0.75,`Scroll end not reached: ${capture.slug}`);
  }
  const original=capture.original.find(m=>!m.horizontal);
  const expanded=capture.expanded.find(m=>!m.horizontal);
  if(original&&expanded) {
    requireCheck(Math.abs(original.content.h-expanded.content.h)<=1,`Content changed during capture: ${capture.slug}`);
    requireCheck(Math.abs(original.content.w-expanded.content.w)<=0.01,`Mobile content width changed: ${capture.slug}`);
  }
  if(capture.stitched) {
    requireCheck(capture.stitched.coveredContentHeightPx===capture.stitched.expectedContentHeightPx,`Stitch omitted rows: ${capture.slug}`);
    requireCheck(capture.stitched.frames.slice(1).every(f=>f.overlapMeanAbsoluteDifference<=2),`Stitch overlap mismatch: ${capture.slug}`);
  } else if(expanded) {
    requireCheck(expanded.content.h-expanded.viewport.h<=0.75,`Expanded native frame clips content: ${capture.slug}`);
  }
  const xml=fs.readFileSync(path.join(directory,capture.hierarchyFile||`evidence/${capture.slug}.xml`),'utf8');
  requireCheck(xml.includes(`resource-id="${capture.id}"`),`Wrong screen hierarchy: ${capture.slug}`);
  requireCheck(!xml.includes('Finding budget eats nearby')&&!xml.includes('There was a problem loading the project'),`Unsettled/error capture: ${capture.slug}`);
  reports.push({file:capture.file,width:metadata.width,height:metadata.height,sha256:crypto.createHash('sha256').update(buffer).digest('hex')});
}
requireCheck(new Set(reports.map(r=>r.sha256)).size===reports.length,'Duplicate screenshot pixels');
const previews=manifest.captures.filter(c=>c.slug.includes('import-preview'));
const intervals=previews.map(c=>{
  const m=c.expanded.find(m=>m.horizontal);
  requireCheck(!!m,`Missing horizontal preview metrics: ${c.slug}`);
  const start=m.viewport.px-m.content.px;
  return {file:c.file,start,end:start+m.viewport.w,width:m.content.w};
}).sort((a,b)=>a.start-b.start);
let covered=0;
for(const i of intervals){requireCheck(i.start<=covered+0.75,'Horizontal preview columns omitted');covered=Math.max(covered,i.end);}
requireCheck(covered>=Math.max(...intervals.map(i=>i.width))-0.75,'Preview missing final columns');
const sourceFiles=[...new Set(registered.values())].map(name=>`src/screens/${name}.jsx`);
sourceFiles.push('src/navigation/RootNavigator.jsx','src/components/ScreenContainer.jsx');
const report={status:'QA_PASSED',scope:'Native screenshot coverage and image integrity only',verifiedAt:new Date().toISOString(),registeredScreens:registered.size,captures:reports.length,sourceCommit:manifest.sourceCommit,verticalContentComplete:true,horizontalPreviewCoverage:intervals,sourceHashes:Object.fromEntries(sourceFiles.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')])),files:reports};
fs.writeFileSync(path.join(directory,'verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,registeredScreens:report.registeredScreens,captures:report.captures,verticalContentComplete:true,horizontalPreviewCoverage:intervals},null,2));
