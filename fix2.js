const fs = require('fs');
let lines = fs.readFileSync('collector.js', 'utf8').split('\n');

// Fix 1: Change sl=en to sl=auto
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('sl=en&tl=zh-CN')) {
    lines[i] = lines[i].replace('sl=en&tl=zh-CN', 'sl=auto&tl=zh-CN');
  }
}

// Fix 2: Change MyMemory langpair
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('langpair=en|zh-CN')) {
    lines[i] = lines[i].replace('langpair=en|zh-CN', 'langpair=auto|zh-CN');
  }
}

// Fix 3: Replace the translation block (lines with "只翻译标题")
let newBlock = [
  '    // Translate title+summary only (fast, skip content to avoid timeout)',
  "    if (item.lang && item.lang !== 'zh') {",
  '      try { const t = await translateToZh(item.title); if (t && t !== item.title) item.title = t; } catch {}',
  '      try { if (item.summary) { const s = await translateToZh(item.summary); if (s && s !== item.summary) item.summary = s; } } catch {}',
  '    }'
];

let result = [];
let skip = 0;
for (let i = 0; i < lines.length; i++) {
  if (skip > 0) { skip--; continue; }
  if (lines[i].includes('\u7ffb\u8bd1\uff08\u53ea\u7ffb\u8bd1\u6807\u9898')) {  // 翻译（只翻译标题
    result.push(...newBlock);
    skip = 3;  // skip old: if block, 2 body lines, closing brace
    continue;
  }
  result.push(lines[i]);
}

// Fix 4: Replace module.exports to add translateUntranslatedContent
let exportLine = result.findIndex(l => l.includes('module.exports'));
if (exportLine >= 0) {
  let newFunc = [
    '',
    'async function translateUntranslatedContent() {',
    "  const items = db.prepare(`SELECT id, content FROM items WHERE lang != 'zh' AND content != '' AND length(content) > 50 AND content NOT LIKE '%\\u3002%' LIMIT 30`).all();",
    "  if (!items.length) return console.log('[Translate] No untranslated content');",
    '  console.log(`[Translate] Translating ${items.length} articles...`);',
    '  let count = 0;',
    '  for (const item of items) {',
    '    try {',
    '      const c = await translateToZh(item.content.slice(0, 800));',
    '      if (c && c.length > 10) {',
    "        const rest = item.content.length > 800 ? '\\n\\n' + item.content.slice(800) : '';",
    "        db.prepare('UPDATE items SET content = ? WHERE id = ?').run(c + rest, item.id);",
    '        count++;',
    '      }',
    '    } catch {}',
    '  }',
    '  console.log(`[Translate] Done: ${count}/${items.length} translated`);',
    '}',
    ''
  ];
  result.splice(exportLine, 1, ...newFunc);
  result.push('module.exports = { collectAll, translateUntranslatedContent };');
}

fs.writeFileSync('collector.js', result.join('\n'), 'utf8');
console.log('Done. Lines: ' + result.length);
