"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {createServer}=require("node:http");
const {createHandler,budget,eats,output}=require("../src/handler.cjs");
const summary={period:"2026-10",currencySymbol:"₱",remainingBudgetMinor:10000,limitBudgetMinor:20000,spentBudgetMinor:10000,categorySpendRatios:[{category:"Food",ratio:0.5}]};
const headers={"Content-Type":"application/json","X-MoneyMap-Consent":"1","X-Firebase-AppCheck":"synthetic-token-for-tests"};
async function serve(handler,fn){
  const server=createServer(handler);
  await new Promise((r)=>server.listen(0,"127.0.0.1",r));
  try{return await fn("http://127.0.0.1:"+server.address().port);}
  finally{await new Promise((r)=>server.close(r));}
}
test("rejects private fields and invalid responses",()=>{
  assert.equal(budget(summary),true);
  assert.equal(budget({...summary,transactions:[{note:"secret"}]}),false);
  assert.equal(budget({...summary,categorySpendRatios:[{category:"Food",ratio:Infinity}]}),false);
  assert.equal(eats({context:"student_eats_near_campus",areaHint:"TIP Quezon City vicinity",currencySymbol:"₱",dailyFoodBudgetMinor:null,places:[]}),true);
  assert.equal(eats({context:"student_eats_near_campus",areaHint:"TIP Quezon City vicinity",currencySymbol:"₱",dailyFoodBudgetMinor:null,places:[{latitude:14}]}),false);
  assert.equal(output('[{"title":"Tip","meta":"Save daily"}]').length,1);
  assert.equal(output('[{"title":"Tip","meta":"Save daily","notes":"secret"}]'),null);
});
test("requires consent and App Check before Gemini",async()=>{
  let calls=0;
  const handler=createHandler({apiKey:"synthetic",verifyAppCheck:async()=>({appId:"registered-app"}),fetchImpl:async()=>{calls++;}});
  await serve(handler,async(url)=>{
    const missing=await fetch(url+"/v1/smart-tips",{method:"POST",headers:{"Content-Type":"application/json","X-MoneyMap-Consent":"1"},body:JSON.stringify(summary)});
    assert.equal(missing.status,401);
    const refused=await fetch(url+"/v1/smart-tips",{method:"POST",headers:{...headers,"X-MoneyMap-Consent":"0"},body:JSON.stringify(summary)});
    assert.equal(refused.status,403);
    const invalid=await fetch(url+"/v1/smart-tips",{method:"POST",headers,body:JSON.stringify({...summary,accountId:1})});
    assert.equal(invalid.status,422);
    assert.equal(calls,0);
  });
});
test("returns validated summaries and handles quota failures",async()=>{
  const response='[{"title":"Pack lunch","meta":"Reduce food expenses","tag":"Food"}]';
  const handler=createHandler({apiKey:"synthetic",verifyAppCheck:async()=>({appId:"registered-app"}),fetchImpl:async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:response}]}}]})})});
  await serve(handler,async(url)=>{
    const res=await fetch(url+"/v1/smart-tips",{method:"POST",headers,body:JSON.stringify(summary)});
    assert.equal(res.status,200);
    assert.equal((await res.json()).tips[0].title,"Pack lunch");
  });
});
