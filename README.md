# AI Hot - AI 热点实时聚合站

自动采集全球 AI 热点资讯，实时翻译为中文，WebSocket 实时推送。

## 功能特性

- **多源采集**: RSS (20+ 源) + Hacker News + Reddit + arXiv + GitHub Trending
- **自动翻译**: 英文内容自动翻译为中文 (MyMemory API)
- **智能去重**: 标题相似度匹配，多信源合并显示
- **自动分类**: 模型/产品/行业/论文/技巧
- **热点排名**: 多信源热度 × 时间衰减
- **实时推送**: WebSocket 新内容即时通知
- **定时采集**: 每 5 分钟自动更新
- **RSS 输出**: 3 个 RSS Feed (精选/全部/日报)

## 快速开始

### 本地运行

`ash
npm install
npm start
# 访问 http://localhost:3456
`

### Railway 部署

1. Fork 本仓库到你的 GitHub
2. 登录 [railway.app](https://railway.app)
3. New Project → Deploy from GitHub repo
4. 选择本仓库
5. Settings → Networking → Generate Domain
6. 完成！访问你的域名

### Render 部署

1. 登录 [render.com](https://render.com)
2. New → Web Service
3. 连接 GitHub 仓库
4. Build Command: 
pm install
5. Start Command: 
pm start
6. Create Web Service

## 信源列表

### RSS 英文
- The Verge AI, TechCrunch AI, Ars Technica, MIT Tech Review
- Wired AI, The Decoder, VentureBeat AI, AI News
- Product Hunt, Latent Space, Ahead of AI
- Interconnects, Gary Marcus, Simon Willison
- Lilian Weng, Hugging Face Blog

### RSS 中文
- IT之家, 36氪, 机器之心, 量子位
- 新智元, AI前线

### API
- Hacker News (AI 关键词过滤)
- Reddit (r/MachineLearning, r/artificial, r/LocalLLaMA)
- arXiv (cs.AI/CL/CV/LG)
- GitHub Trending (AI/LLM repos)

## API 接口

- GET /api/items - 资讯列表 (支持 mode/category/q/page/limit)
- GET /api/hot - 热点排名
- GET /api/stats - 统计数据
- POST /api/collect - 手动触发采集
- GET /feed.xml - RSS 精选
- GET /feed/all.xml - RSS 全部
- GET /feed/daily.xml - RSS 日报

## 环境变量

- PORT - 服务端口 (默认 3456)

## 技术栈

- **后端**: Express.js + SQLite + WebSocket
- **前端**: 原生 JavaScript + CSS
- **翻译**: MyMemory API (免费)
- **采集**: rss-parser + node-cron

## 许可证

MIT
