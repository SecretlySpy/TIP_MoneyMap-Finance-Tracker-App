(() => {
  const store=__moneyMapCapture.finance;
  const current=store.getState();
  const fields=['accounts','categories','transactions','budgets','goals','recurringRules','selectedMonthYear'];
  if(!globalThis.__moneyMapOriginalData)globalThis.__moneyMapOriginalData=Object.fromEntries(fields.map(k=>[k,current[k]]));
  const base=globalThis.__moneyMapOriginalData;
  if(base.transactions.length||base.budgets.length||base.goals.length||base.recurringRules.length)throw new Error('Sample capture requires a fresh development profile');
  const cat=(name,type='EXPENSE')=>base.categories.find(c=>c.name===name&&c.type===type).id;
  const account=base.accounts[0].id;
  const date=day=>new Date(2026,8,day,12).getTime();
  const names=['Food','Transport','School','Shopping','Bills','Entertainment'];
  const transactions=[
    {id:1001,amountMinor:1500000,type:'INCOME',categoryId:cat('Allowance','INCOME'),accountId:account,dateEpochMillis:date(1),note:'September allowance (demo)',recurringRuleId:null},
    ...Array.from({length:12},(_,i)=>({id:1002+i,amountMinor:[12000,4000,35000,89000,99900,15000][i%6],type:'EXPENSE',categoryId:cat(names[i%6]),accountId:base.accounts[i%3].id,dateEpochMillis:date(Math.min(6,2+Math.floor(i/2))),note:['Campus lunch','Jeepney fare','School supplies','Study desk','Internet plan','Movie with friends'][i%6]+' (demo)',recurringRuleId:null})),
  ];
  store.setState({
    selectedMonthYear:'2026-09',
    accounts:[...base.accounts.map((a,i)=>({...a,startingBalanceMinor:[350000,100000,200000][i]})),{id:1099,name:'Old wallet (demo)',type:'EWALLET',startingBalanceMinor:0,isArchived:true}],
    transactions,
    budgets:names.map((name,i)=>({id:2000+i,categoryId:cat(name),monthYear:'2026-09',limitMinor:[300000,150000,250000,150000,300000,100000][i]})),
    goals:['New laptop','Tuition fund','Emergency fund','Graduation trip'].map((name,i)=>({id:3000+i,name,targetMinor:[3500000,2000000,1000000,1500000][i],currentMinor:[1200000,750000,300000,100000][i],deadlineEpochMillis:new Date(2026,10+i,15,12).getTime(),createdEpochMillis:date(1),isArchived:false})),
    recurringRules:['Internet plan','Monthly rent','Mobile data','Streaming'].map((note,i)=>({id:4000+i,amountMinor:[99900,350000,19900,14900][i],type:'EXPENSE',categoryId:cat('Bills'),accountId:account,note,frequency:'MONTHLY',nextRunEpochMillis:date(7+i),isActive:true,reminderEnabled:true,reminderLeadDays:3,icon:['🌐','🏠','📱','🎬'][i]})),
  });
  return {sample:true,transactions:13,budgets:6,goals:4,recurringRules:4};
})();
