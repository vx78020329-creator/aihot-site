(function() {
  'use strict';

  let currentPage = 'curated';
  let currentCategory = '';
  let currentSearch = '';
  let pageNum = 1;
  let ws = null;
  let wsRetryCount = 0;
  let sidebarOpen = false;

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  // ── 工具 ──
  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const s = (Date.now() - d) / 1000;
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + '分钟前';
    if (s < 86400) return Math.floor(s / 3600) + '小时前';
    if (s < 604800) return Math.floor(s / 86400) + '天前';
    return d.toLocaleDateString('zh-CN');
  }
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
  }
  function formatTime(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  function scoreClass(s) { return s >= 70 ? 'score-high' : s >= 50 ? 'score-mid' : 'score-low'; }
  function esc(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }

  function contentToHtml(content) {
    if (!content) return '<p style="color:var(--text-3)">暂无正文内容</p>';
    return content.split(/\n{2,}/).filter(p => p.trim()).map(p => '<p>' + esc(p.trim()) + '</p>').join('');
  }

  // ── 侧边栏（关键修复） ──
  function openSidebar() {
    sidebarOpen = true;
    $('#sidebar').classList.add('open');
    $('#sidebar-overlay').classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    sidebarOpen = false;
    $('#sidebar').classList.remove('open');
    $('#sidebar-overlay').classList.remove('show');
    document.body.style.overflow = '';
  }
  function toggleSidebar() {
    sidebarOpen ? closeSidebar() : openSidebar();
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

    if (page === 'item' && cat) { showDetail(parseInt(cat)); return; }

    currentPage = page;
    currentCategory = cat;
    pageNum = 1;

    $$('.side-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
    $$('.side-cat-link').forEach(l => l.classList.toggle('active', l.dataset.cat === cat));

    loadList();
    closeSidebar();
  }

  // ── 加载列表 ──
  async function loadList() {
    const area = $('#content-area');
    area.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';

    let url = `/api/items?mode=${currentPage}&page=${pageNum}&limit=30`;
    if (currentCategory) url += `&category=${encodeURIComponent(currentCategory)}`;
    if (currentSearch) url += `&q=${encodeURIComponent(currentSearch)}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      renderTimeline(data.items, data.total, data.page, data.pages);
    } catch {
      area.innerHTML = '<div class="empty-state"><p>加载失败，请重试</p></div>';
    }
  }

  // ── 渲染时间线 ──
  function renderTimeline(items, total, page, pages) {
    const area = $('#content-area');
    if (!items || !items.length) {
      area.innerHTML = '<div class="empty-state"><p>暂无内容，正在采集中...</p></div>';
      return;
    }

    const groups = {};
    for (const item of items) {
      const day = item.published_at ? formatDate(item.published_at) : '未知日期';
      (groups[day] = groups[day] || []).push(item);
    }

    let html = '';
    for (const [day, dayItems] of Object.entries(groups)) {
      html += `<div class="timeline-group"><div class="timeline-date">${esc(day)}</div>`;
      for (const item of dayItems) {
        html += `
          <div class="timeline-item" onclick="window.__openItem(${item.id})">
            <div class="timeline-body">
              <div class="timeline-head">
                <span class="timeline-source">${esc(item.source)}</span>
                <span class="timeline-time">${formatTime(item.published_at)}</span>
                ${item.is_curated ? '<span class="curated-badge">精选</span>' : ''}
                <span class="timeline-score ${scoreClass(item.score)}">${item.score}</span>
              </div>
              <div class="timeline-title">${esc(item.title)}</div>
              ${item.summary ? '<div class="timeline-summary">' + esc(item.summary) + '</div>' : ''}
            </div>
          </div>`;
      }
      html += '</div>';
    }

    if (pages > 1) {
      html += '<div class="pagination">';
      html += `<button class="page-btn" onclick="window.__goPage(${page-1})" ${page<=1?'disabled':''}>上一页</button>`;
      for (let i = Math.max(1,page-2); i <= Math.min(pages,page+2); i++) {
        html += `<button class="page-btn ${i===page?'active':''}" onclick="window.__goPage(${i})">${i}</button>`;
      }
      html += `<button class="page-btn" onclick="window.__goPage(${page+1})" ${page>=pages?'disabled':''}>下一页</button>`;
      html += '</div>';
    }

    area.innerHTML = html;
  }

  // ── 详情页 ──
  async function showDetail(id) {
    const overlay = $('#detail-overlay');
    const body = $('#detail-body');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    body.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';

    try {
      const res = await fetch(`/api/items/${id}`);
      const data = await res.json();
      const item = data.item;
      const related = data.related || [];

      const extLink = $('#detail-ext-link');
      if (item.link) { extLink.href = item.link; extLink.style.display = ''; }
      else { extLink.style.display = 'none'; }

      let html = '';
      html += `<div class="detail-source">
        <span>${esc(item.source)}</span>
        <span>·</span>
        <span>${timeAgo(item.published_at)}</span>
        ${item.is_curated ? '<span class="curated-badge">精选</span>' : ''}
        <span class="timeline-score ${scoreClass(item.score)}">${item.score}</span>
      </div>`;
      html += `<h1 class="detail-title">${esc(item.title)}</h1>`;
      html += `<div class="detail-meta">
        <span>${item.published_at ? new Date(item.published_at).toLocaleString('zh-CN') : ''}</span>
        <span>·</span><span>${esc(item.source)}</span>
      </div>`;

      if (item.reason) {
        html += `<div class="detail-reason">
          <div class="detail-reason-label">💡 推荐理由</div>
          <div class="detail-reason-text">${esc(item.reason)}</div>
        </div>`;
      }
      if (item.image_url) {
        html += `<img class="detail-image" src="${esc(item.image_url)}" alt="" loading="lazy" onerror="this.style.display='none'" />`;
      }
      html += `<div class="detail-content">${contentToHtml(item.content || item.summary)}</div>`;

      if (item.tags && item.tags !== '[]') {
        try {
          const tags = JSON.parse(item.tags);
          if (tags.length) {
            html += '<div class="detail-tags">';
            tags.forEach(t => { html += `<span class="detail-tag">${esc(t)}</span>`; });
            html += '</div>';
          }
        } catch {}
      }

      if (related.length > 0) {
        html += '<div class="detail-related"><div class="detail-related-title">📰 相关资讯</div>';
        related.forEach(r => {
          html += `<div class="related-item" onclick="window.__openItem(${r.id})">
            <span class="related-item-title">${esc(r.title)}</span>
            <span class="related-item-meta">${esc(r.source)}</span>
          </div>`;
        });
        html += '</div>';
      }

      body.innerHTML = html;
    } catch {
      body.innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
    }
  }

  function closeDetail() {
    $('#detail-overlay').classList.remove('open');
    document.body.style.overflow = '';
    if (location.hash.startsWith('#/item/')) history.back();
  }

  // ── 分享 ──
  function shareItem() {
    const title = document.querySelector('.detail-title')?.textContent || '';
    const link = $('#detail-ext-link')?.href || location.href;
    if (navigator.share) {
      navigator.share({ title, url: link }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(link);
      const btn = $('#btn-share');
      btn.textContent = '已复制';
      setTimeout(() => { btn.textContent = '分享'; }, 1500);
    }
  }

  // ── WebSocket ──
  function connectWS() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      ws = new WebSocket(`${protocol}//${location.host}`);
    } catch { return; }

    ws.onopen = () => {
      wsRetryCount = 0;
      $('#ws-status').classList.remove('off');
      $('#ws-status').title = '实时连接正常';
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'new_items' && data.items?.length > 0) showToast(data.items.length);
      } catch {}
    };
    ws.onclose = () => {
      $('#ws-status').classList.add('off');
      const delay = Math.min(30000, 1000 * Math.pow(2, wsRetryCount++));
      setTimeout(connectWS, delay);
    };
    ws.onerror = () => ws.close();
  }

  function showToast(count) {
    document.querySelector('.new-toast')?.remove();
    const t = document.createElement('div');
    t.className = 'new-toast';
    t.textContent = `📰 ${count} 条新资讯，点击刷新`;
    t.onclick = () => { t.remove(); loadList(); };
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 8000);
  }

  // ── 统计 ──
  async function loadStats() {
    try {
      const data = await (await fetch('/api/stats')).json();
      $('#stats-info').textContent = `共 ${data.total} 条 · 今日 ${data.today} · ${data.sources} 源`;

      const nav = $('#category-nav');
      nav.innerHTML = '';
      for (const cat of data.categories) {
        const a = document.createElement('a');
        a.className = 'side-cat-link';
        a.dataset.cat = cat.category;
        a.textContent = `${cat.category} (${cat.cnt})`;
        a.href = `#/cat/${cat.category}`;
        a.onclick = e => {
          e.preventDefault();
          currentPage = 'all'; currentCategory = cat.category; pageNum = 1;
          location.hash = `#/cat/${cat.category}`;
          closeSidebar();
          loadList();
        };
        nav.appendChild(a);
      }
    } catch {}
  }

  // ── 全局函数 ──
  window.__openItem = id => { location.hash = `#/item/${id}`; };
  window.__goPage = p => { pageNum = p; loadList(); $('#content-area').scrollTop = 0; };

  // ── 初始化 ──
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    connectWS();
    loadStats();
    window.addEventListener('hashchange', handleRoute);
    handleRoute();

    // 搜索
    let timer;
    $('#search-input').addEventListener('input', e => {
      clearTimeout(timer);
      timer = setTimeout(() => { currentSearch = e.target.value.trim(); pageNum = 1; loadList(); }, 400);
    });

    // 详情页关闭
    $('#detail-back').onclick = closeDetail;
    $('#detail-overlay').onclick = e => { if (e.target === $('#detail-overlay')) closeDetail(); };
    $('#btn-share').onclick = shareItem;
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if ($('#detail-overlay').classList.contains('open')) closeDetail();
        else if (sidebarOpen) closeSidebar();
      }
    });

    // 侧边栏
    $('#menu-toggle').onclick = toggleSidebar;
    $('#sidebar-overlay').onclick = closeSidebar;

    // 手动采集
    $('#btn-collect').onclick = async () => {
      const btn = $('#btn-collect');
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div>';
      try {
        const res = await fetch('/api/collect', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          btn.textContent = `✓ +${data.newItems?.length || 0}`;
          loadList(); loadStats();
        }
      } catch { btn.textContent = '失败'; }
      setTimeout(() => { btn.innerHTML = ''; btn.textContent = '刷新'; btn.disabled = false; }, 2500);
    };

    // 定时刷新统计
    setInterval(loadStats, 60000);
  });
})();
