module.exports = {
  rss_en: [
    { name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
    { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
    { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/' },
    { name: 'Wired AI', url: 'https://www.wired.com/feed/tag/ai/latest/rss' },
    { name: 'The Decoder', url: 'https://the-decoder.com/feed/' },
    { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' },
    { name: 'AI News', url: 'https://www.artificialintelligence-news.com/feed/' },
    { name: 'Product Hunt', url: 'https://www.producthunt.com/feed' },
    { name: 'Latent Space', url: 'https://www.latent.space/feed' },
    { name: 'Ahead of AI (Seb Raschka)', url: 'https://magazine.sebastianraschka.com/feed' }
  ],
  rss_cn: [
    { name: 'IT之家', url: 'https://www.ithome.com/rss/' },
    { name: '36氪', url: 'https://36kr.com/feed' },
    { name: '机器之心', url: 'https://www.jiqizhixin.com/rss' },
    { name: '量子位', url: 'https://www.qbitai.com/feed' },
    { name: '新智元', url: 'https://www.xinzhiyuan.com/feed' },
    { name: 'AI前线', url: 'https://www.infoq.cn/topic/AI/feed' }
  ],
  rss_blogs: [
    { name: 'Interconnects', url: 'https://www.interconnects.ai/feed' },
    { name: 'Gary Marcus', url: 'https://garymarcus.substack.com/feed' },
    { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/' },
    { name: 'Lilian Weng', url: 'https://lilianweng.github.io/index.xml' },
    { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml' }
  ],
  hackernews: {
    enabled: true,
    top_n: 30,
    min_score: 50,
    keywords: ['ai', 'gpt', 'llm', 'openai', 'anthropic', 'claude', 'gemini', 'machine learning', 'deep learning', 'neural', 'transformer', 'diffusion', 'chatbot', 'copilot', 'agi', 'model', 'training', 'inference', 'rag', 'agent']
  },
  reddit: [
    { name: 'MachineLearning', enabled: true, limit: 25 },
    { name: 'artificial', enabled: true, limit: 25 },
    { name: 'LocalLLaMA', enabled: true, limit: 25 }
  ],
  github: {
    enabled: true,
    trending_url: 'https://api.github.com/search/repositories?q=topic:artificial-intelligence+topic:llm&sort=updated&order=desc&per_page=15',
  },
  arxiv: {
    enabled: true,
    categories: ['cs.AI', 'cs.CL', 'cs.CV', 'cs.LG'],
    max_results: 30
  }
};
