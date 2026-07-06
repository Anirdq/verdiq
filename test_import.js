const Papa = require('papaparse');

const csvText = `symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration
MNQU6,-2,0,0.25,549465350039,549465350013,1,29806.75,29750.25,$(113.00),06/23/2026 19:17:46,06/23/2026 19:16:34,1min 11sec
MNQU6,-2,0,0.25,549465350044,549465350024,1,29806.75,29747.25,$(119.00),06/23/2026 19:17:46,06/23/2026 19:17:01,44sec`;

Papa.parse(csvText, {
  header: true,
  skipEmptyLines: true,
  transformHeader: function(h) {
    return h.trim().replace(/"/g, '').toLowerCase();
  },
  complete: function(results) {
    const rows = results.data;
    console.log(rows);
    for (const row of rows) {
      const buyPrice = row['buyprice'] || row['buy price'];
      const sellPrice = row['sellprice'] || row['sell price'];
      console.log('buyprice:', buyPrice, 'sellprice:', sellPrice);

      let pnlStr = String(
        row['p&l'] || row['profit'] || row['net pnl'] || row['pnl'] || 
        row['p/l'] || row['net p/l'] || row['gross p/l'] || row['realized'] || '0'
      ).trim();
      const isNegative = pnlStr.includes('(') && pnlStr.includes(')') || pnlStr.includes('-');
      pnlStr = pnlStr.replace(/[^0-9.]+/g, "");
      let pnl = parseFloat(pnlStr) || 0;
      if (isNegative) pnl = -pnl;
      console.log('PnL:', pnl);
    }
  }
});
