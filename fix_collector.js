const fs = require('fs');
let code = fs.readFileSync('collector.js', 'utf8');

// Fix 1: Replace the slow content translation with fast title+summary only
code = code.replace(
  /\/\/ 翻译所有非中文内容[\s\S]*?item\.tags = '\[\]';/,
  `// 翻译标题+摘要（快速，不翻译正文避免超时）
    if (item.lang && item.lang !== 'zh') {
      try { const t = await translateToZh(item.title); if (t && t !== item.title) item.title = t; } catch {}
      try { if (item.summary) { const s = await translateToZh(item.summary); if (s && s !== item.summary) item.summary = s; } } catch {}
    }
    item.tags = '[]';`
);

// Fix 2: Add content translation function and export it
code = code.replace(
  /module\.exports = \{ collectAll \};/,
  `async function translateUntranslatedContent() {
  const items = db.prepare(\`SELECT id, content FROM items WHERE lang != 'zh' AND content != '' AND length(content) > 50 AND content NOT LIKE '%。%' LIMIT 30\`).all();
  if (!items.length) return console.log('[Translate] No untranslated content');
  console.log(\`[Translate] Translating \${items.length} articles...\`);
  let count = 0;
  for (const item of items) {
    try {
      const c = await translateToZh(item.content.slice(0, 800));
      if (c && c.length > 10) {
        const rest = item.content.length > 800 ? '\\n\\n' + item.content.slice(800) : '';
        db.prepare('UPDATE items SET content = ? WHERE id = ?').run(c + rest, item.id);
        count++;
      }
    } catch {}
  }
  console.log(\`[Translate] Done: \${count}/\${items.length} translated\`);
}

module.exports = { collectAll, translateUntranslatedContent };`
);

fs.writeFileSync('collector.js', code, 'utf8');
console.log('Done');
