// 全球热点资讯源配置 — 覆盖科技、AI、商业、世界新闻、科学、中文媒体
module.exports = [
  // ── 科技 ──
  { name: 'TechCrunch',       type: 'rss', url: 'https://techcrunch.com/feed/',                          category: '科技', lang: 'en' },
  { name: 'The Verge',        type: 'rss', url: 'https://www.theverge.com/rss/index.xml',                category: '科技', lang: 'en' },
  { name: 'Ars Technica',     type: 'rss', url: 'https://feeds.arstechnica.com/arstechnica/index',       category: '科技', lang: 'en' },
  { name: 'Wired',            type: 'rss', url: 'https://www.wired.com/feed/rss',                        category: '科技', lang: 'en' },
  { name: 'Engadget',         type: 'rss', url: 'https://www.engadget.com/rss.xml',                      category: '科技', lang: 'en' },

  // ── AI ──
  { name: 'MIT Tech Review',  type: 'rss', url: 'https://www.technologyreview.com/feed/',                category: 'AI', lang: 'en' },
  { name: 'OpenAI Blog',      type: 'rss', url: 'https://openai.com/blog/rss.xml',                       category: 'AI', lang: 'en' },
  { name: 'Google AI Blog',   type: 'rss', url: 'https://blog.google/technology/ai/rss/',                 category: 'AI', lang: 'en' },
  { name: 'HuggingFace',      type: 'rss', url: 'https://huggingface.co/blog/feed.xml',                  category: 'AI', lang: 'en' },

  // ── 世界新闻 ──
  { name: 'BBC World',        type: 'rss', url: 'https://feeds.bbci.co.uk/news/world/rss.xml',            category: '世界', lang: 'en' },
  { name: 'BBC Tech',         type: 'rss', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',       category: '科技', lang: 'en' },

  // ── 科学 ──
  { name: 'Nature News',      type: 'rss', url: 'https://www.nature.com/nature.rss',                      category: '科学', lang: 'en' },
  { name: 'Science Daily',    type: 'rss', url: 'https://www.sciencedaily.com/rss/all.xml',                category: '科学', lang: 'en' },

  // ── 开发者 ──
  { name: 'Hacker News',      type: 'hn',  url: 'https://hacker-news.firebaseio.com/v0',                  category: '开发', lang: 'en' },
  { name: 'Product Hunt',     type: 'rss', url: 'https://www.producthunt.com/feed',                        category: '产品', lang: 'en' },

  // ── Reddit ──
  { name: 'Reddit Tech',      type: 'reddit', subreddit: 'technology',                                     category: '科技', lang: 'en' },
  { name: 'Reddit World',     type: 'reddit', subreddit: 'worldnews',                                      category: '世界', lang: 'en' },
  { name: 'Reddit Science',   type: 'reddit', subreddit: 'science',                                        category: '科学', lang: 'en' },
  { name: 'Reddit AI',        type: 'reddit', subreddit: 'MachineLearning',                                category: 'AI', lang: 'en' },
  { name: 'Reddit Futurology', type: 'reddit', subreddit: 'Futurology',                                    category: '科技', lang: 'en' },

  // ── 中文源 ──
  { name: '36氪',             type: 'rss', url: 'https://36kr.com/feed',                                   category: '商业', lang: 'zh' },
  { name: '少数派',           type: 'rss', url: 'https://sspai.com/feed',                                   category: '科技', lang: 'zh' },
  { name: 'IT之家',           type: 'rss', url: 'https://www.ithome.com/rss/',                              category: '科技', lang: 'zh' },
];
