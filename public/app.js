(function() {
  'use strict';

  // ── 状态 ──
  let currentPage = 'curated';
  let currentCategory = '';
  let currentSearch = '';
  let pageNum = 1;
  let ws = null;
  let wsRetryCount = 0;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ── 工具 ──
  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
    if (diff < 604800) return Math.floor(diff / 86400) + '天前';
    return d.toLocaleDateString('zh-CN');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  function scoreClass(score) {
    if (score >= 70) return 'score-high';
    if (score >= 50) return 'score-mid';
    return 'score-low';
  }

  function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function contentToHtml(content) {
    if (!content) return '<p style="color:var(--text-3)">暂无正文内容</p>';
    const paragraphs = content.split(/\n{2,}/);
    return paragraphs.map(p => {
      p = p.trim();
      if (!p) return '';
      return '<p>' + escapeHtml(p) + '</p>';
    }).join('');
  }

  // ── 主题 ──
  function initTheme() {
    const mode = localStorage.getItem('theme-mode') || 'dark';
    applyTheme(mode);
    $$('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
      btn.onclick = () => {
        const m = btn.dataset.mode;
        localStorage.setItem('theme-mode', m);
        applyTheme(m);
        $$('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
      };
    });
  }

  function applyTheme(mode) {
    let actual = mode;
    if (mode === 'auto') actual = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', actual);
    document.documentElement.setAttribute('data-theme-mode', mode);
  }

  // ── 路由 ──
  function handleRoute() {
    const hash = location.hash || '#/';
    const parts = hash.replace('#/', '').split('/');
    const page = parts[0] || 'curated';
    const cat = parts[1] || '';

    if (page === 'item' && cat) {
      showDetail(parseInt(cat));
      return;
    }

    currentPage = page;
    currentCategory = cat;
    pageNum = 1;

    // 更新侧边栏高亮
    $$('.side-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
    $$('.side-cat-link').forEach(l => l.classList.toggle('active', l.dataset.cat === cat));

    loadList();
  }

  // ── 加载列表 ──
  async function loadList() {
    const area = $('#content-area');
    area.innerHTML = '<div class="loading">加载中...</div>';

    let mode = currentPage;
    let url = `/api/items?mode=${mode}&page=${pageNum}&limit=30`;

    if (currentCategory) {
      url += `&category=${encodeURIComponent(currentCategory)}`;
    }
    if (currentSearch) {
      url += `&q=${encodeURIComponent(currentSearch)}`;
    }

    try {
      const res = await fetch(url);
      const data = await res.json();
      renderTimeline(data.items, data.total, data.page, data.pages);
    } catch (e) {
      area.innerHTML = '<div class="empty-state"><p>加载失败，请重试</p></div>';
    }
  }

  // ── 渲染时间线 ──
  function renderTimeline(items, total, page, pages) {
    const area = $('#content-area');

    if (!items || items.length === 0) {
      area.innerHTML = '<div class="empty-state"><p>暂无内容，正在采集...</p></div>';
      return;
    }

    // 按日期分组
    const groups = {};
    for (const item of items) {
      const day = item.published_at ? formatDate(item.published_at) : '未知日期';
      if (!groups[day]) groups[day] = [];
      groups[day].push(item);
    }

    let html = '';
    for (const [day, dayItems] of Object.entries(groups)) {
      html += `<div class="timeline-group">`;
      html += `<div class="timeline-date">${escapeHtml(day)}</div>`;
      for (const item of dayItems) {
        const sc = scoreClass(item.score);
        html += `
          <div class="timeline-item" data-id="${item.id}" onclick="window.__openItem(${item.id})">
            <div class="timeline-rail"><span class="timeline-dot"></span></div>
            <div class="timeline-body">
              <div class="timeline-head">
                <span class="timeline-source">${escapeHtml(item.source)}</span>
                <span class="timeline-time">${formatTime(item.published_at)}</span>
                ${item.is_curated ? '<span class="curated-badge">精选</span>' : ''}
                <span class="timeline-score ${sc}">${item.score}</span>
              </div>
              <div class="timeline-title">${escapeHtml(item.title)}</div>
              <div class="timeline-summary">${escapeHtml(item.summary || '')}</div>
            </div>
          </div>`;
      }
      html += '</div>';
    }

    // 分页
    if (pages > 1) {
      html += '<div class="pagination">';
      html += `<button class="page-btn" onclick="window.__goPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>上一页</button>`;
      for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="window.__goPage(${i})">${i}</button>`;
      }
      html += `<button class="page-btn" onclick="window.__goPage(${page + 1})" ${page >= pages ? 'disabled' : ''}>下一页</button>`;
      html += '</div>';
    }

    area.innerHTML = html;
  }

  // ── 详情页 ──
  async function showDetail(id) {
    const overlay = $('#detail-overlay');
    const body = $('#detail-body');
    const extLink = $('#detail-ext-link');

    body.innerHTML = '<div class="loading">加载中...</div>';
    overlay.classList.add('open');

    try {
      const res = await fetch(`/api/items/${id}`);
      const data = await res.json();
      const item = data.item;
      const related = data.related || [];

      extLink.href = item.link || '#';
      extLink.style.display = item.link ? '' : 'none';

      let html = '';
      html += `<div class="detail-source">
        <span>${escapeHtml(item.source)}</span>
        <span class="timeline-time">${timeAgo(item.published_at)}</span>
        ${item.is_curated ? '<span class="curated-badge">精选</span>' : ''}
        <span class="timeline-score ${scoreClass(item.score)}">${item.score}</span>
      </div>`;

      html += `<h1 class="detail-title">${escapeHtml(item.title)}</h1>`;

      html += `<div class="detail-meta">
        <span>${item.published_at ? new Date(item.published_at).toLocaleString('zh-CN') : ''}</span>
        <span>·</span>
        <span>${escapeHtml(item.source)}</span>
      </div>`;

      if (item.reason) {
        html += `<div class="detail-reason">
          <div class="detail-reason-label">💡 推荐理由</div>
          <div class="detail-reason-text">${escapeHtml(item.reason)}</div>
        </div>`;
      }

      if (item.image_url) {
        html += `<img class="detail-image" src="${escapeHtml(item.image_url)}" alt="" onerror="this.style.display='none'" />`;
      }

      html += `<div class="detail-content">${contentToHtml(item.content || item.summary)}</div>`;

      if (item.tags && item.tags !== '[]') {
        try {
          const tags = JSON.parse(item.tags);
          if (tags.length) {
            html += '<div class="detail-tags">';
            tags.forEach(t => { html += `<span class="detail-tag">${escapeHtml(t)}</span>`; });
            html += '</div>';
          }
        } catch {}
      }

      if (related.length > 0) {
        html += '<div class="detail-related">';
        html += '<div class="detail-related-title">📰 相关资讯</div>';
        related.forEach(r => {
          html += `<div class="related-item" onclick="window.__openItem(${r.id})">
            <span class="related-item-title">${escapeHtml(r.title)}</span>
            <span class="related-item-meta">${escapeHtml(r.source)}</span>
          </div>`;
        });
        html += '</div>';
      }

      body.innerHTML = html;
    } catch (e) {
      body.innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
    }
  }

  function closeDetail() {
    $('#detail-overlay').classList.remove('open');
    history.back();
  }

  // ── WebSocket ──
  function connectWS() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);

    ws.onopen = () => {
      console.log('[WS] Connected');
      wsRetryCount = 0;
      $('#ws-status').classList.remove('off');
      $('#ws-status').title = '实时连接正常';
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'new_items' && data.items?.length > 0) {
          showNewToast(data.items.length);
        }
      } catch {}
    };

    ws.onclose = () => {
      $('#ws-status').classList.add('off');
      $('#ws-status').title = '连接断开，重连中...';
      const delay = Math.min(30000, 1000 * Math.pow(2, wsRetryCount++));
      setTimeout(connectWS, delay);
    };

    ws.onerror = () => ws.close();
  }

  function showNewToast(count) {
    const existing = document.querySelector('.new-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'new-toast';
    toast.textContent = `📰 ${count} 条新资讯，点击刷新`;
    toast.onclick = () => { toast.remove(); loadList(); };
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 10000);
  }

  // ── 统计 ──
  async function loadStats() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      const info = $('#stats-info');
      info.textContent = `共 ${data.total} 条 · 今日 ${data.today} · ${data.sources} 源`;

      // 加载分类导航
      const nav = $('#category-nav');
      nav.innerHTML = '';
      for (const cat of data.categories) {
        const a = document.createElement('a');
        a.className = 'side-cat-link';
        a.dataset.cat = cat.category;
        a.textContent = `${cat.category} (${cat.cnt})`;
        a.href = `#/cat/${cat.category}`;
        a.onclick = (e) => {
          e.preventDefault();
          currentPage = 'all';
          currentCategory = cat.category;
          pageNum = 1;
          location.hash = `#/cat/${cat.category}`;
          loadList();
          $$('.side-link').forEach(l => l.classList.remove('active'));
          $$('.side-cat-link').forEach(l => l.classList.toggle('active', l.dataset.cat === cat.category));
        };
        nav.appendChild(a);
      }
    } catch {}
  }

  // ── 全局函数 ──
  window.__openItem = (id) => {
    location.hash = `#/item/${id}`;
  };
  window.__goPage = (p) => {
    pageNum = p;
    loadList();
    $('#content-area').scrollTop = 0;
  };

  // ── 初始化 ──
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    connectWS();
    loadStats();

    // 路由
    window.addEventListener('hashchange', handleRoute);
    handleRoute();

    // 搜索
    let searchTimer;
    $('#search-input').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        currentSearch = e.target.value.trim();
        pageNum = 1;
        loadList();
      }, 400);
    });

    // 返回按钮
    $('#detail-back').onclick = closeDetail;
    $('#detail-overlay').onclick = (e) => {
      if (e.target === $('#detail-overlay')) closeDetail();
    };
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#detail-overlay').classList.contains('open')) closeDetail();
    });

    // 手动采集
    $('#btn-collect').onclick = async () => {
      $('#btn-collect').textContent = '采集中...';
      $('#btn-collect').disabled = true;
      try {
        const res = await fetch('/api/collect', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          $('#btn-collect').textContent = `完成 +${data.newItems?.length || 0}`;
          loadList();
          loadStats();
        }
      } catch {}
      setTimeout(() => {
        $('#btn-collect').textContent = '刷新';
        $('#btn-collect').disabled = false;
      }, 3000);
    };

    // 移动端菜单
    $('#menu-toggle').onclick = () => {
      $('#sidebar').classList.toggle('open');
    };

    // 定时刷新统计
    setInterval(loadStats, 60000);
  });
})();
