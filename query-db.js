const Database = require('better-sqlite3');
const db = new Database('./local.db', { readonly: true });

try {
  const paid = db.prepare('SELECT id, isPaid, createdAt FROM submissions WHERE isPaid = 1 LIMIT 5').all();
  console.log('=== PAID RECORDS ===');
  console.log(JSON.stringify(paid, null, 2));
  
  const withSuggestions = db.prepare(`
    SELECT id, isPaid, 
           CASE WHEN fullSuggestions IS NOT NULL THEN 'YES' ELSE 'NO' END as hasSuggestions
    FROM submissions 
    WHERE isPaid = 1 
    LIMIT 5
  `).all();
  console.log('\n=== WITH FULL SUGGESTIONS ===');
  console.log(JSON.stringify(withSuggestions, null, 2));
} catch (e) {
  console.error('Error:', e.message);
} finally {
  db.close();
}
