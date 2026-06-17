const fs = require('fs');
let code = fs.readFileSync('collector.js', 'utf8');

// Fix the broken template literal
code = code.replace(
  "db.prepare(SELECT id, content FROM items WHERE lang != 'zh' AND content != '' AND length(content) > 50 AND content NOT LIKE ''。'' LIMIT 30).all()",
  "db.prepare(`SELECT id, content FROM items WHERE lang != 'zh' AND content != '' AND length(content) > 50 AND content NOT LIKE '%。%' LIMIT 30`).all()"
);

fs.writeFileSync('collector.js', code, 'utf8');
console.log('Fixed');
