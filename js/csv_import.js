const ImportCSV = (() => {
  async function handleImport(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: function(h) {
          return h.trim().replace(/"/g, '').toLowerCase();
        },
        complete: async function(results) {
          try {
            const rows = results.data;
            let importCount = 0;

          for (const row of rows) {
            // Generic mapping logic
            // Tradovate often has 'symbol', 'timestamp', 'price', 'p&l', etc.
            // MetaTrader has 'time', 'deal', 'symbol', 'type', 'direction', 'price', 'profit'
            
            const dateStr = row['timestamp'] || row['time'] || row['date'] || row['close time'] || row['boughttimestamp'] || row['soldtimestamp'];
            if (!dateStr) continue; // skip invalid rows

            const instrument = row['symbol'] || row['item'] || row['contract'] || 'UNKNOWN';
            
            // Try to figure out PnL
            let pnlStr = String(
              row['p&l'] || row['profit'] || row['net pnl'] || row['pnl'] || 
              row['p/l'] || row['net p/l'] || row['gross p/l'] || row['realized'] || '0'
            ).trim();
            const isNegative = pnlStr.includes('(') && pnlStr.includes(')') || pnlStr.includes('-');
            pnlStr = pnlStr.replace(/[^0-9.]+/g, "");
            let pnl = parseFloat(pnlStr) || 0;
            if (isNegative) pnl = -pnl;

            // Direction
            let dir = 'Long';
            const typeStr = (row['type'] || row['direction'] || row['buy/sell'] || row['side'] || '').toLowerCase();
            if (typeStr.includes('sell') || typeStr.includes('short')) dir = 'Short';
            
            // Tradovate specific direction inference
            if (!typeStr && row['boughttimestamp'] && row['soldtimestamp']) {
              const bTime = new Date(row['boughttimestamp']).getTime();
              const sTime = new Date(row['soldtimestamp']).getTime();
              if (sTime < bTime) dir = 'Short';
            }

            // Prices
            let entry = parseFloat(row['entry price'] || row['price'] || row['open price']) || 0;
            let exit = parseFloat(row['exit price'] || row['close price']) || 0;

            const buyPrice = row['buyprice'] || row['buy price'];
            const sellPrice = row['sellprice'] || row['sell price'];

            if (buyPrice && sellPrice) {
              if (dir === 'Long') {
                entry = parseFloat(buyPrice) || 0;
                exit = parseFloat(sellPrice) || 0;
              } else {
                entry = parseFloat(sellPrice) || 0;
                exit = parseFloat(buyPrice) || 0;
              }
            }
            const qty = parseFloat(row['qty'] || row['quantity'] || row['volume']) || 1;

            const trade = {
              id: Utils.uuid(),
              date: new Date(dateStr).toISOString(),
              instrument: instrument.toUpperCase(),
              direction: dir,
              entryPrice: entry,
              exitPrice: exit,
              quantity: qty,
              resultMoney: pnl,
              setupName: 'Imported Trade',
              ruleFollowed: true,
              mistakeTags: [],
            };

            await Store.addTrade(trade);
            importCount++;
          }
          resolve(importCount);
        } catch (err) {
          reject(err);
        }
      },
      error: function(err) {
        reject(err);
      }
    });
  });
}

  return { handleImport };
})();
