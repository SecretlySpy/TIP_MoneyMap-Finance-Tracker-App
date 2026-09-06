(() => {
  const api=__moneyMapCapture.moduleByPath('src/services/importFile.js');
  if(!globalThis.__moneyMapOriginalPicker)globalThis.__moneyMapOriginalPicker=api.pickAndParseImportFile;
  const parser=__moneyMapCapture.moduleByPath('src/domain/services/importParser.js');
  const headers=['Date','Amount','Type','Category','Account','Note'];
  const grid=[headers,
    ['2026-09-01','15000.00','INCOME','Allowance','CASH','Demo allowance'],
    ['2026-09-02','120.00','EXPENSE','Food','CASH','Demo lunch'],
    ['2026-09-02','40.00','EXPENSE','Transport','EWALLET','Demo commute'],
    ['2026-09-03','350.00','EXPENSE','School','CARD','Demo books'],
    ['2026-09-04','199.00','EXPENSE','Load/Data','EWALLET','Demo mobile data'],
  ];
  const mappings=parser.detectImportMappings(headers);
  api.pickAndParseImportFile=()=>Promise.resolve({fileName:'demo-transactions.csv',format:'csv',headers,grid,mappings,preview:parser.parseImportGrid(grid,mappings)});
  return true;
})();
