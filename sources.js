// 全球热点资讯源 — 科技+AI+世界+科学+开发+商业+中文
module.exports = [
  // ── 科技 ──
  { name: 'TechCrunch',       type: 'rss', url: 'https://techcrunch.com/feed/',                      category: '科技', lang: 'en' },
  { name: 'The Verge',        type: 'rss', url: 'https://www.theverge.com/rss/index.xml',            category: '科技', lang: 'en' },
  { name: 'Ars Technica',     type: 'rss', url: 'https://feeds.arstechnica.com/arstechnica/index',   category: '科技', lang: 'en' },
  { name: 'Wired',            type: 'rss', url: 'https://www.wired.com/feed/rss',                    category: '科技', lang: 'en' },
  { name: 'Engadget',         type: 'rss', url: 'https://www.engadget.com/rss.xml',                  category: '科技', lang: 'en' },
  { name: 'Mashable',         type: 'rss', url: 'https://mashable.com/feeds/rss',                    category: '科技', lang: 'en' },
  { name: 'Gizmodo',          type: 'rss', url: 'https://gizmodo.com/feed',                          category: '科技', lang: 'en' },
  { name: 'TNW',              type: 'rss', url: 'https://thenextweb.com/feed',                       category: '科技', lang: 'en' },
  { name: 'DigitalTrends',    type: 'rss', url: 'https://www.digitaltrends.com/feed/',               category: '科技', lang: 'en' },

  // ── AI ──
  { name: 'MIT Tech Review',  type: 'rss', url: 'https://www.technologyreview.com/feed/',            category: 'AI', lang: 'en' },
  { name: 'OpenAI Blog',      type: 'rss', url: 'https://openai.com/blog/rss.xml',                   category: 'AI', lang: 'en' },
  { name: 'Google AI Blog',   type: 'rss', url: 'https://blog.google/technology/ai/rss/',             category: 'AI', lang: 'en' },
  { name: 'HuggingFace',      type: 'rss', url: 'https://huggingface.co/blog/feed.xml',              category: 'AI', lang: 'en' },
  { name: 'VentureBeat AI',   type: 'rss', url: 'https://venturebeat.com/category/ai/feed/',         category: 'AI', lang: 'en' },

  // ── 世界 ──
  { name: 'BBC World',        type: 'rss', url: 'https://feeds.bbci.co.uk/news/world/rss.xml',       category: '世界', lang: 'en' },
  { name: 'BBC Tech',         type: 'rss', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',  category: '科技', lang: 'en' },
  { name: 'NPR News',         type: 'rss', url: 'https://feeds.npr.org/1001/rss.xml',                category: '世界', lang: 'en' },
  { name: 'Guardian World',   type: 'rss', url: 'https://www.theguardian.com/world/rss',             category: '世界', lang: 'en' },

  // ── 科学 ──
  { name: 'Nature News',      type: 'rss', url: 'https://www.nature.com/nature.rss',                 category: '科学', lang: 'en' },
  { name: 'Science Daily',    type: 'rss', url: 'https://www.sciencedaily.com/rss/all.xml',           category: '科学', lang: 'en' },
  { name: 'Phys.org',         type: 'rss', url: 'https://phys.org/rss-feed/',                         category: '科学', lang: 'en' },

  // ── 开发 ──
  { name: 'Hacker News',      type: 'hn',  url: 'https://hacker-news.firebaseio.com/v0',             category: '开发', lang: 'en' },
  { name: 'Product Hunt',     type: 'rss', url: 'https://www.producthunt.com/feed',                   category: '产品', lang: 'en' },

  // ── 商业 ──
  { name: 'Bloomberg Tech',   type: 'rss', url: 'https://feeds.bloomberg.com/technology/news.rss',   category: '商业', lang: 'en' },
  { name: 'Forbes Tech',      type: 'rss', url: 'https://www.forbes.com/innovation/feed/',           category: '商业', lang: 'en' },

  // ── 中文 ──
  { name: '36氪',             type: 'rss', url: 'https://36kr.com/feed',                             category: '商业', lang: 'zh' },
  { name: '少数派',           type: 'rss', url: 'https://sspai.com/feed',                             category: '科技', lang: 'zh' },
  { name: 'IT之家',           type: 'rss', url: 'https://www.ithome.com/rss/',                        category: '科技', lang: 'zh' },
  { name: 'CNBC Tech', type: 'rss', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910', category: '商业', lang: 'en' },
  { name: 'NYT Tech', type: 'rss', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', category: '科技', lang: 'en' },
  { name: 'Yahoo Tech', type: 'rss', url: 'https://www.yahoo.com/news/rss/tech', category: '科技', lang: 'en' },
];