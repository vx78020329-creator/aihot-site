// ȫ���ȵ���ѶԴ �� �Ƽ�+AI+����+��ѧ+����+��ҵ+����
module.exports = [
  // ���� �Ƽ� ����
  { name: 'TechCrunch',       type: 'rss', url: 'https://techcrunch.com/feed/',                      category: '�Ƽ�', lang: 'en' },
  { name: 'The Verge',        type: 'rss', url: 'https://www.theverge.com/rss/index.xml',            category: '�Ƽ�', lang: 'en' },
  { name: 'Ars Technica',     type: 'rss', url: 'https://feeds.arstechnica.com/arstechnica/index',   category: '�Ƽ�', lang: 'en' },
  { name: 'Wired',            type: 'rss', url: 'https://www.wired.com/feed/rss',                    category: '�Ƽ�', lang: 'en' },
  { name: 'Engadget',         type: 'rss', url: 'https://www.engadget.com/rss.xml',                  category: '�Ƽ�', lang: 'en' },
  { name: 'Mashable',         type: 'rss', url: 'https://mashable.com/feeds/rss',                    category: '�Ƽ�', lang: 'en' },
  { name: 'Gizmodo',          type: 'rss', url: 'https://gizmodo.com/feed',                          category: '�Ƽ�', lang: 'en' },
  { name: 'TNW',              type: 'rss', url: 'https://thenextweb.com/feed',                       category: '�Ƽ�', lang: 'en' },
  { name: 'DigitalTrends',    type: 'rss', url: 'https://www.digitaltrends.com/feed/',               category: '�Ƽ�', lang: 'en' },
  { name: 'BBC Tech',         type: 'rss', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',  category: '�Ƽ�', lang: 'en' },
  { name: 'NYT Tech',         type: 'rss', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', category: '�Ƽ�', lang: 'en' },
  { name: 'ZDNet',            type: 'rss', url: 'https://www.zdnet.com/news/rss.xml',                category: '�Ƽ�', lang: 'en' },
  { name: 'Register',         type: 'rss', url: 'https://www.theregister.com/headlines.atom',        category: '�Ƽ�', lang: 'en' },
  { name: 'Yahoo Tech',       type: 'rss', url: 'https://www.yahoo.com/news/rss/tech',               category: '�Ƽ�', lang: 'en' },

  // ���� AI ����
  { name: 'MIT Tech Review',  type: 'rss', url: 'https://www.technologyreview.com/feed/',            category: 'AI', lang: 'en' },
  { name: 'OpenAI Blog',      type: 'rss', url: 'https://openai.com/blog/rss.xml',                   category: 'AI', lang: 'en' },
  { name: 'Google AI Blog',   type: 'rss', url: 'https://blog.google/technology/ai/rss/',             category: 'AI', lang: 'en' },
  { name: 'HuggingFace',      type: 'rss', url: 'https://huggingface.co/blog/feed.xml',              category: 'AI', lang: 'en' },
  { name: 'VentureBeat AI',   type: 'rss', url: 'https://venturebeat.com/category/ai/feed/',         category: 'AI', lang: 'en' },
  { name: 'AI News',          type: 'rss', url: 'https://www.artificialintelligence-news.com/feed/', category: 'AI', lang: 'en' },

  // ���� ���� ����
  { name: 'BBC World',        type: 'rss', url: 'https://feeds.bbci.co.uk/news/world/rss.xml',       category: '����', lang: 'en' },
  { name: 'NPR News',         type: 'rss', url: 'https://feeds.npr.org/1001/rss.xml',                category: '����', lang: 'en' },
  { name: 'Guardian World',   type: 'rss', url: 'https://www.theguardian.com/world/rss',             category: '����', lang: 'en' },
  { name: 'Reuters World',    type: 'rss', url: 'https://www.reutersagency.com/feed/',               category: '����', lang: 'en' },
  { name: 'Al Jazeera',       type: 'rss', url: 'https://www.aljazeera.com/xml/rss/all.xml',         category: '����', lang: 'en' },

  // ���� ��ѧ ����
  { name: 'Nature News',      type: 'rss', url: 'https://www.nature.com/nature.rss',                 category: '��ѧ', lang: 'en' },
  { name: 'Science Daily',    type: 'rss', url: 'https://www.sciencedaily.com/rss/all.xml',           category: '��ѧ', lang: 'en' },
  { name: 'Phys.org',         type: 'rss', url: 'https://phys.org/rss-feed/',                         category: '��ѧ', lang: 'en' },
  { name: 'Space.com',        type: 'rss', url: 'https://www.space.com/feeds/all',                    category: '��ѧ', lang: 'en' },
  { name: 'LiveScience',      type: 'rss', url: 'https://www.livescience.com/feeds/all',             category: '��ѧ', lang: 'en' },

  // ���� ���� ����
  { name: 'Hacker News',      type: 'hn',  url: 'https://hacker-news.firebaseio.com/v0',             category: '����', lang: 'en' },
  { name: 'Product Hunt',     type: 'rss', url: 'https://www.producthunt.com/feed',                   category: '��Ʒ', lang: 'en' },
  { name: 'Slashdot',         type: 'rss', url: 'https://rss.slashdot.org/Slashdot/slashdotMain',    category: '����', lang: 'en' },

  // ���� ��ҵ ����
  { name: 'Bloomberg Tech',   type: 'rss', url: 'https://feeds.bloomberg.com/technology/news.rss',   category: '��ҵ', lang: 'en' },
  { name: 'Forbes Tech',      type: 'rss', url: 'https://www.forbes.com/innovation/feed/',           category: '��ҵ', lang: 'en' },
  { name: 'CNBC Tech',        type: 'rss', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910', category: '��ҵ', lang: 'en' },
  { name: 'TechCrunch Biz',   type: 'rss', url: 'https://techcrunch.com/category/business/feed/',    category: '��ҵ', lang: 'en' },

  // ���� ����Դ ����
  { name: '36�',             type: 'rss', url: 'https://36kr.com/feed',                             category: '��ҵ', lang: 'zh' },
  { name: '������',           type: 'rss', url: 'https://sspai.com/feed',                             category: '�Ƽ�', lang: 'zh' },
  { name: 'IT֮��',           type: 'rss', url: 'https://www.ithome.com/rss/',                        category: '�Ƽ�', lang: 'zh' },
  { name: '����',             type: 'rss', url: 'https://www.huxiu.com/rss/0.xml',                    category: '��ҵ', lang: 'zh' },
  { name: '����λ',           type: 'rss', url: 'https://www.qbitai.com/feed',                        category: 'AI', lang: 'zh' },
  { name: '����֮��',         type: 'rss', url: 'https://www.jiqizhixin.com/rss',                     category: 'AI', lang: 'zh' },
  { name: '������',           type: 'rss', url: 'https://www.ifanr.com/feed',                         category: '�Ƽ�', lang: 'zh' },

  // ���� Reddit ����
  { name: 'Reddit r/worldnews', type: 'reddit', subreddit: 'worldnews', url: '', category: '����', lang: 'en' },
  { name: 'Reddit r/technology', type: 'reddit', subreddit: 'technology', url: '', category: '�Ƽ�', lang: 'en' },
  { name: 'Reddit r/science', type: 'reddit', subreddit: 'science', url: '', category: '��ѧ', lang: 'en' },
  { name: 'Reddit r/artificial', type: 'reddit', subreddit: 'artificial', url: '', category: 'AI', lang: 'en' },
];