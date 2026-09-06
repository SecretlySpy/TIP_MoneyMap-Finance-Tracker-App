import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const sharp=createRequire(path.join(ROOT,'package.json'))('sharp');
const OUT = fileURLToPath(new URL('../', import.meta.url));
fs.mkdirSync(OUT, {recursive:true});
const serial = process.env.MONEYMAP_CAPTURE_SERIAL || 'emulator-5554';
const port = process.env.MONEYMAP_CAPTURE_PORT || '8082';
const appId = process.env.MONEYMAP_CAPTURE_APP_ID || 'com.example.financetracker';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const adb = (...args) => execFileSync('adb', ['-s', serial, ...args], {maxBuffer:64*1024*1024});
const originalSize=adb('shell','wm','size').toString().match(/Override size: (\d+x\d+)/)?.[1] || 'reset';
const densityOutput=adb('shell','wm','density').toString();
const density=Number(densityOutput.match(/Override density: (\d+)/)?.[1] || densityOutput.match(/Physical density: (\d+)/)?.[1]);
if(density!==420)throw new Error('This capture snapshot requires the documented 420 dpi emulator');
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
const target = targets.find(t=>t.appId === appId);
if (!target) throw new Error('MoneyMap debugger not connected');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let nextId=0;
const pending=new Map();
ws.onmessage=({data})=>{
  const message=JSON.parse(data);
  const request=pending.get(message.id);
  if(!request)return;
  pending.delete(message.id);clearTimeout(request.timer);
  if(message.error || message.result?.exceptionDetails) request.reject(new Error(JSON.stringify(message)));
  else request.resolve(message.result?.result?.value);
};
const evaluate=expression=>new Promise((resolve,reject)=>{
  const id=++nextId;
  const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Debugger timed out'));},15000);
  pending.set(id,{resolve,reject,timer});
  const asciiExpression=expression.replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression:asciiExpression,returnByValue:true}}));
});
await evaluate(fs.readFileSync(new URL('./runtime.js', import.meta.url),'utf8'));
const existingRows=await evaluate('Object.fromEntries(["transactions","budgets","goals","recurringRules"].map(k=>[k,__moneyMapCapture.finance.getState()[k].length]))');
if(Object.values(existingRows).some(n=>n>0)){ws.close();throw new Error('Use a fresh local development profile for the documented empty and sample states');}
const measure=async id=>{
  const count=await evaluate(`__moneyMapCapture.measure(${JSON.stringify(id)})`);
  for(let i=0;i<25;i++) {
    await wait(80);
    const values=await evaluate('__moneyMapCapture.measurements');
    if(values.length===count && values.every(m=>m.content&&m.viewport)) return values;
  }
  throw new Error(`Native measurement timed out for ${id}`);
};
const specs = [
  {slug:'01-dashboard-empty',title:'Dashboard — empty',tab:'Home',screen:'Dashboard',id:'dashboard-screen'},
  {slug:'02-entry-expense',title:'Add transaction — expense',tab:'Home',screen:'Entry',id:'entry-screen'},
  {slug:'03-history-empty',title:'History — empty',tab:'History',screen:'HistoryList',id:'history-screen'},
  {slug:'04-budgets-empty',title:'Budgets — empty',tab:'Budgets',screen:'BudgetsOverview',id:'budgets-screen'},
  {slug:'05-recurring-empty',title:'Recurring and reminders — empty',tab:'Budgets',screen:'Recurring',id:'recurring-screen'},
  {slug:'06-settings',title:'Settings',tab:'Settings',screen:'SettingsOverview',id:'settings-screen'},
  {slug:'07-goals-empty',title:'Savings goals — empty',tab:'Settings',screen:'Goals',id:'goals-screen'},
  {slug:'08-manage-categories',title:'Manage categories',tab:'Settings',screen:'ManageCategories',id:'manage-categories-screen'},
  {slug:'09-manage-accounts',title:'Manage accounts',tab:'Settings',screen:'ManageAccounts',id:'manage-accounts-screen'},
  {slug:'10-import-file',title:'Import CSV or Excel — choose file',tab:'Settings',screen:'Import',id:'import-screen'},
  {slug:'11-restore-backup',title:'Restore from backup',tab:'Settings',screen:'PasteImport',params:{mode:'backup'},id:'paste-import-screen'},
  {slug:'12-import-pasted-csv',title:'Import pasted CSV',tab:'Settings',screen:'PasteImport',params:{mode:'csv'},id:'paste-import-screen'},
  {slug:'13-app-lock',title:'App lock — create PIN',tab:null,screen:'AppLock',id:'app-lock-screen'},
  {slug:'14-smart-tips-empty',title:'Smart Tips — offline, empty',tab:'Home',screen:'SmartTips',id:'smart-tips-screen',before:'__moneyMapCapture.ui.setState({smartTipsEnabled:true,smartTipsConsentAccepted:false})'},
  {slug:'15-student-eats',title:'Student Eats Near Me',tab:'Home',screen:'StudentEats',id:'student-eats-screen',settle:3000},
  {slug:'16-entry-income',title:'Add transaction — income',tab:'Home',screen:'Entry',id:'entry-screen',after:["__moneyMapCapture.press('Income')"]},
  {slug:'17-dashboard-populated',title:'Dashboard — sample data',tab:'Home',screen:'Dashboard',id:'dashboard-screen',sample:true},
  {slug:'18-history-populated',title:'History — sample data',tab:'History',screen:'HistoryList',id:'history-screen',sample:true},
  {slug:'19-budgets-populated',title:'Budgets — sample data',tab:'Budgets',screen:'BudgetsOverview',id:'budgets-screen',sample:true},
  {slug:'20-recurring-populated',title:'Recurring and reminders — sample data',tab:'Budgets',screen:'Recurring',id:'recurring-screen',sample:true},
  {slug:'21-goals-populated',title:'Savings goals — sample data',tab:'Settings',screen:'Goals',id:'goals-screen',sample:true},
  {slug:'22-smart-tips-populated',title:'Smart Tips — offline, sample data',tab:'Home',screen:'SmartTips',id:'smart-tips-screen',sample:true,before:'__moneyMapCapture.ui.setState({smartTipsEnabled:true,smartTipsConsentAccepted:false})'},
  {slug:'23-accounts-archived',title:'Accounts — active and archived sample data',tab:'Settings',screen:'ManageAccounts',id:'manage-accounts-screen',sample:true},
  {slug:'24-import-preview-left',title:'Import — preview first columns',tab:'Settings',screen:'Import',id:'import-screen',importSample:true,after:["__moneyMapCapture.press('Choose File')"]},
  {slug:'25-import-preview-right',title:'Import — preview remaining columns',tab:'Settings',screen:'Import',id:'import-screen',importSample:true,horizontalEnd:true,after:["__moneyMapCapture.press('Choose File')"]},
  {slug:'26-import-map-columns',title:'Import — map columns',tab:'Settings',screen:'Import',id:'import-screen',importSample:true,after:["__moneyMapCapture.press('Choose File')","__moneyMapCapture.press('Next: Map Columns')"]},
  {slug:'27-import-validate',title:'Import — validation',tab:'Settings',screen:'Import',id:'import-screen',importSample:true,after:["__moneyMapCapture.press('Choose File')","__moneyMapCapture.press('Next: Map Columns')","__moneyMapCapture.press('Next: Validate')"]},
  {slug:'28-budget-category-form',title:'Budgets — category icon form',tab:'Budgets',screen:'BudgetsOverview',id:'budgets-screen',sample:true,after:["__moneyMapCapture.press('＋ Add budget')","__moneyMapCapture.confirmPrompt('Budget category name','Sample supplies')"]},
  {slug:'29-recurring-bill-form',title:'Recurring — frequency, category, reminder form',tab:'Budgets',screen:'Recurring',id:'recurring-screen',sample:true,after:["__moneyMapCapture.press('＋ Add recurring bill')","__moneyMapCapture.confirmPrompt('Bill name','Sample bill')"]},
  {slug:'30-account-type-form',title:'Accounts — create account type',tab:'Settings',screen:'ManageAccounts',id:'manage-accounts-screen',sample:true,after:["__moneyMapCapture.press('＋ Add account')","__moneyMapCapture.confirmPrompt('New account name','Sample wallet')"]},
  {slug:'31-import-preview-middle',title:'Import — preview middle columns',tab:'Settings',screen:'Import',id:'import-screen',importSample:true,horizontalFraction:0.5,after:["__moneyMapCapture.press('Choose File')"]},
];
const selected=process.argv.slice(2);
let manifest=[];
let metadata={};
const manifestPath=path.join(OUT,'manifest.json');
if(fs.existsSync(manifestPath)){metadata=JSON.parse(fs.readFileSync(manifestPath,'utf8'));manifest=metadata.captures;}
try {
  for(const spec of specs.filter(s=>!selected.length || selected.includes(s.slug))) {
    adb('shell','wm','size','1080x2400');
    await wait(650);
    if(spec.sample)await evaluate(fs.readFileSync(new URL('./finance-sample.js', import.meta.url),'utf8'));
    if(spec.importSample)await evaluate(fs.readFileSync(new URL('./import-sample.js', import.meta.url),'utf8'));
    if(spec.before) await evaluate(spec.before);
    await evaluate(`__moneyMapCapture.navigate(${JSON.stringify(spec.tab)},${JSON.stringify(spec.screen)},${JSON.stringify(spec.params||{})})`);
    await wait(spec.settle||1000);
    if(spec.screen==='StudentEats') {
      let loading=true;
      for(let attempt=0;attempt<60&&loading;attempt++) {
        loading=await evaluate('__moneyMapCapture.find(f=>f.memoizedProps?.accessibilityLabel==="Loading places")!==null');
        if(loading)await wait(1000);
      }
      if(loading)throw new Error('Student Eats did not finish loading; refusing a loading-only page');
    }
    for(const action of spec.after||[]) {await evaluate(action);await wait(650);}
    let original = await measure(spec.id);
    for(let stable=0,attempt=0;stable<2&&attempt<12;attempt++) {
      await wait(300);
      const next=await measure(spec.id);
      stable=JSON.stringify(next)===JSON.stringify(original)?stable+1:0;
      original=next;
    }
    if(original.length) {
      await evaluate('__moneyMapCapture.scrolls.filter(s=>!s.props.horizontal).forEach(s=>s.scrollTo({y:100000,animated:false}));true');
      await wait(250);
    }
    const atEnd=await measure(spec.id);
    for(const m of atEnd.filter(m=>!m.horizontal)) {
      const gap=m.content.py+m.content.h-m.viewport.py-m.viewport.h;
      if(gap>0.75)throw new Error(`Native scroll did not reach the end: ${gap} dp`);
    }
    const main=original.find(m=>!m.horizontal);
    let height=2400;
    if(main) height+=Math.max(0,Math.ceil((main.content.h-main.viewport.h)*2.625));
    if(height>16000)throw new Error(`Unreasonably tall page: ${height}`);
    adb('shell','wm','size',`1080x${height}`);
    await wait(850);
    await evaluate('__moneyMapCapture.scrolls.forEach(s=>s.scrollTo({x:0,y:0,animated:false}));true');
    if(spec.horizontalEnd)await evaluate('__moneyMapCapture.scrolls.filter(s=>s.props.horizontal).forEach(s=>s.scrollToEnd({animated:false}));true');
    if(spec.horizontalFraction) {
      const horizontal=original.find(m=>m.horizontal);
      if(!horizontal)throw new Error('Horizontal preview missing');
      await evaluate(`__moneyMapCapture.scrolls.filter(s=>s.props.horizontal).forEach(s=>s.scrollTo({x:${(horizontal.content.w-horizontal.viewport.w)*spec.horizontalFraction},animated:false}));true`);
    }
    await wait(250);
    let expanded=await measure(spec.id);
    const overflow=expanded.filter(m=>!m.horizontal).reduce((max,m)=>Math.max(max,m.content.h-m.viewport.h),0);
    if(main && Math.abs(main.content.h-expanded.find(m=>!m.horizontal).content.h)>1)throw new Error(`Content height changed during expansion: ${spec.slug}`);
    const file=`${spec.slug}.png`;
    let buffer=adb('exec-out','screencap','-p');
    const rawHeight=buffer.readUInt32BE(20);
    let stitched=null;
    if(overflow>0.75) {
      const metrics=expanded.find(m=>!m.horizontal);
      const top=Math.round(metrics.viewport.py*2.625);
      const vh=Math.round(metrics.viewport.h*2.625);
      const bottom=top+vh;
      const first=buffer;
      let last=buffer;
      let body=await sharp(first).extract({left:0,top,width:1080,height:vh}).png().toBuffer();
      let offset=0;
      const frames=[{offsetPx:0}];
      const expectedOffset=Math.round((metrics.content.h-metrics.viewport.h)*2.625);
      while(offset<expectedOffset) {
        const requested=Math.min(expectedOffset,offset+Math.floor(vh*0.55));
        await evaluate(`__moneyMapCapture.scrolls.find(s=>!s.props.horizontal).scrollTo({y:${requested/2.625},animated:false});true`);
        await wait(400);
        const currentMetrics=(await measure(spec.id)).find(m=>!m.horizontal);
        const actual=Math.round((currentMetrics.viewport.py-currentMetrics.content.py)*2.625);
        if(actual<=offset || actual-offset>=vh-100)throw new Error('Invalid native scroll overlap');
        const next=adb('exec-out','screencap','-p');
        const delta=actual-offset;
        const seam=Math.floor((actual+offset+vh)/2);
        const stripHeight=Math.min(400,vh-delta-40);
        const stripStart=Math.floor((vh-delta-stripHeight)/2);
        const a=await sharp(last).extract({left:40,top:top+delta+stripStart,width:1000,height:stripHeight}).removeAlpha().raw().toBuffer();
        const b=await sharp(next).extract({left:40,top:top+stripStart,width:1000,height:stripHeight}).removeAlpha().raw().toBuffer();
        let difference=0;for(let i=0;i<a.length;i++)difference+=Math.abs(a[i]-b[i]);
        const meanDifference=difference/a.length;
        if(meanDifference>2)throw new Error(`Screenshot overlap mismatch: ${meanDifference}`);
        const kept=await sharp(body).extract({left:0,top:0,width:1080,height:seam}).png().toBuffer();
        const added=await sharp(next).extract({left:0,top:top+seam-actual,width:1080,height:vh-(seam-actual)}).png().toBuffer();
        body=await sharp({create:{width:1080,height:actual+vh,channels:3,background:'#ffffff'}}).composite([{input:kept,top:0,left:0},{input:added,top:seam,left:0}]).png().toBuffer();
        offset=actual;last=next;
        frames.push({offsetPx:actual,overlapMeanAbsoluteDifference:meanDifference,metrics:currentMetrics});
      }
      const header=await sharp(first).extract({left:0,top:0,width:1080,height:top}).png().toBuffer();
      const footer=await sharp(last).extract({left:0,top:bottom,width:1080,height:rawHeight-bottom}).png().toBuffer();
      buffer=await sharp({create:{width:1080,height:rawHeight+offset,channels:3,background:'#ffffff'}}).composite([{input:header,left:0,top:0},{input:body,left:0,top},{input:footer,left:0,top:top+offset+vh}]).png().toBuffer();
      height=rawHeight+offset;
      stitched={reason:'Android caps wm size to 7200 pixels',frames,coveredContentHeightPx:offset+vh,expectedContentHeightPx:Math.round(metrics.content.h*2.625)};
      if(stitched.coveredContentHeightPx!==stitched.expectedContentHeightPx)throw new Error('Incomplete stitched content');
    }
    const pngWidth=buffer.readUInt32BE(16),pngHeight=buffer.readUInt32BE(20);
    if(pngWidth!==1080||pngHeight!==height)throw new Error(`Wrong framebuffer ${pngWidth}x${pngHeight}`);
    fs.writeFileSync(path.join(OUT,file),buffer);
    adb('shell','uiautomator','dump','/sdcard/moneymap-capture.xml');
    const xml=adb('shell','cat','/sdcard/moneymap-capture.xml').toString();
    fs.mkdirSync(path.join(OUT,'evidence'),{recursive:true});
    fs.writeFileSync(path.join(OUT,'evidence',`${spec.slug}.xml`),xml);
    const entry={...spec,before:undefined,after:undefined,settle:undefined,file,hierarchyFile:`evidence/${spec.slug}.xml`,width:pngWidth,height:pngHeight,original,atEnd,expanded,stitched,verticalOverflowDp:stitched?0:overflow,capturedAt:new Date().toISOString()};
    manifest=manifest.filter(m=>m.slug!==spec.slug).concat(entry).sort((a,b)=>a.slug.localeCompare(b.slug));
    fs.writeFileSync(manifestPath,JSON.stringify({...metadata,platform:'Android 16 / API 36',appId:target.appId,renderer:'native React Native development build with current Metro source',density:420,widthDp:1080/2.625,baseViewport:{width:1080,height:2400},method:'Measure native content and scroll end, expand height at unchanged width/density; pages exceeding the emulator limit use measured overlapping native frames with verified pixel alignment.',captures:manifest},null,2)+'\n');
    console.log(`${file}: ${pngWidth}x${pngHeight}; ${stitched?`stitched ${stitched.frames.length} native frames`:'full native frame'}; complete vertical content`);
  }
} finally {
  await evaluate('if(globalThis.__moneyMapOriginalData){__moneyMapCapture.finance.setState(globalThis.__moneyMapOriginalData)};true').catch(()=>{});
  await evaluate('__moneyMapCapture.ui.setState({smartTipsEnabled:false,smartTipsConsentAccepted:false});true').catch(()=>{});
  await evaluate('if(globalThis.__moneyMapOriginalPicker){__moneyMapCapture.moduleByPath("src/services/importFile.js").pickAndParseImportFile=globalThis.__moneyMapOriginalPicker};true').catch(()=>{});
  adb('shell','wm','size',originalSize);
  ws.close();
}
