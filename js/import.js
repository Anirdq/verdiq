const ImportCSV = (() => {
  // Very basic CSV parser
  function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];
    
    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
    
    const results = [];
    for (let i = 1; i < lines.length; i++) {
      // Very basic split by comma, ignoring commas inside quotes is hard with regex,
      // but for basic tradovate/MT4 it usually works if we just split.
      // A better regex for CSV splitting:
      const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
      if (row.length === headers.length) {
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = row[idx]; });
        results.push(obj);
      }
    }
    return results;
  }

  async function handleImport(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target.result;
          const rows = parseCSV(text);
          let importCount = 0;

          for (const row of rows) {
            // Generic mapping logic
            // Tradovate often has 'symbol', 'timestamp', 'price', 'p&l', etc.
            // MetaTrader has 'time', 'deal', 'symbol', 'type', 'direction', 'price', 'profit'
            
            const dateStr = row['timestamp'] || row['time'] || row['date'] || row['close time'] || row['boughttimestamp'] || row['soldtimestamp'];
            if (!dateStr) continue; // skip invalid rows

            const instrument = row['symbol'] || row['item'] || row['contract'] || 'UNKNOWN';
            
            // Try to figure out PnL
            let pnlStr = String(row['p&l'] || row['profit'] || row['net pnl'] || row['pnl'] || '0').trim();
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

            if (row['buyprice'] && row['sellprice']) {
              if (dir === 'Long') {
                entry = parseFloat(row['buyprice']) || 0;
                exit = parseFloat(row['sellprice']) || 0;
              } else {
                entry = parseFloat(row['sellprice']) || 0;
                exit = parseFloat(row['buyprice']) || 0;
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
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  return { handleImport };
})();
