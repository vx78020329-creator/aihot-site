(function () {
  'use strict';
  // --- WebSocket for real-time push ---
  let ws = null;
  let reconnectTimer = null;
  function connectWS() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(protocol + '//' + location.host);
    ws.onopen = () => console.log('[WS] Connected');
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'new_items' && msg.items && msg.items.length > 0) {
          showNewItemsToast(msg.items.length);
          // If on curated/all view, prepend new items
          if (currentMode === 'curated' || currentMode === 'all') {
            loadItems();
            loadHot();
            loadStats();
          }
        }
      } catch(err) {}
    };
    ws.onclose = () => {
      console.log('[WS] Disconnected, reconnecting in 5s...');
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connectWS, 5000);
    };
    ws.onerror = () => ws.close();
  }
  connectWS();

  function showNewItemsToast(count) {
    // Create a toast notification
    let toast = document.getElementById('ws-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ws-toast';
      toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#3b82f6;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;cursor:pointer;box-shadow:0 4px 20px rgba(59,130,246,0.4);transition:opacity 0.3s;opacity:0;';
      toast.onclick = () => { loadItems(); loadHot(); loadStats(); toast.style.opacity = '0'; };
      document.body.appendChild(toast);
    }
    toast.textContent = '🆕 ' + count + ' 条新资讯，点击查看';
    toast.style.opacity = '1';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 8000);
  }


  let currentMode = 'curated';
  let currentCategory = '';
  let currentQuery = '';
  let currentPage = 1;
  const LIMIT = 30;
  let refreshTimer = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // --- Time ago ---
  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return mins + ' 分钟前';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' 小时前';
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + ' 天前';
    return Math.floor(days / 30) + ' 月前';
  }

  // --- Fetch helpers ---
  async function fetchJSON(url) {
    const res = await fetch(url);
    return res.json();
  }

  // --- Render stats ---
  async function loadStats() {
    try {
      const data = await fetchJSON('/api/stats');
      const cats = (data.categories || []).map(c =>
        '<span class="stat-item"><span class="feed-cat" data-cat="' + c.category + '">' + c.category + '</span> <span class="stat-val">' + c.cnt + '</span></span>'
      ).join('');
      $('#stats-bar').innerHTML =
        '<span class="stat-item">📊 总计 <span class="stat-val">' + data.total + '</span></span>' +
        '<span class="stat-item">📅 今日 <span class="stat-val">' + data.today + '</span></span>' +
        '<span class="stat-item">📡 源 <span class="stat-val">' + data.sources + '</span></span>' +
        cats;
    } catch (e) {
      console.error('Stats error', e);
    }
  }

  // --- Render items ---
  function renderItems(items) {
    const list = $('#feed-list');
    if (!items || items.length === 0) {
      list.innerHTML = '<div class="loading">暂无内容，点击"采集"获取最新资讯</div>';
      return;
    }
    list.innerHTML = items.map(item => {
      const cat = item.category || 'uncategorized';
      return '<div class="feed-item">' +
        '<div class="feed-title"><a href="' + (item.link || '#') + '" target="_blank" rel="noopener">' + escHtml(item.title) + '</a></div>' +
        (item.summary ? '<div class="feed-summary">' + escHtml(item.summary) + '</div>' : '') +
        '<div class="feed-meta">' +
          '<span class="feed-cat" data-cat="' + escHtml(cat) + '">' + escHtml(cat) + '</span>' +
          '<span class="feed-source">' + escHtml(item.source_name || '') + '</span>' +
          '<span>' + timeAgo(item.collected_at || item.published_at) + '</span>' +
          (item.source_count > 1 ? '<span class="feed-count">🔥 ' + item.source_count + ' 源</span>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  // --- Fetch items ---
  async function loadItems() {
    try {
      const params = new URLSearchParams({ mode: currentMode, page: currentPage, limit: LIMIT });
      if (currentCategory) params.set('category', currentCategory);
      if (currentQuery) params.set('q', currentQuery);
      const data = await fetchJSON('/api/items?' + params);
      renderItems(data.items);
      renderPagination(data.page, data.pages);
      updateFeedHeader();
    } catch (e) {
      console.error('Items error', e);
      $('#feed-list').innerHTML = '<div class="loading">加载失败</div>';
    }
  }

  // --- Pagination ---
  function renderPagination(page, pages) {
    const el = $('#pagination');
    if (pages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    html += '<button class="page-btn" data-p="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>‹</button>';
    const start = Math.max(1, page - 3);
    const end = Math.min(pages, page + 3);
    for (let i = start; i <= end; i++) {
      html += '<button class="page-btn' + (i === page ? ' active' : '') + '" data-p="' + i + '">' + i + '</button>';
    }
    html += '<button class="page-btn" data-p="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + '>›</button>';
    el.innerHTML = html;
  }

  // --- Hot sidebar ---
  async function loadHot() {
    try {
      const data = await fetchJSON('/api/hot');
      const list = $('#hot-list');
      if (!data.items || data.items.length === 0) {
        list.innerHTML = '<div class="loading">暂无热点</div>';
        return;
      }
      list.innerHTML = data.items.map((item, i) => {
        const rankClass = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : 'other';
        return '<div class="hot-item" onclick="window.open(\'' + (item.link || '').replace(/'/g, "\\'") + '\',\'_blank\')">' +
          '<span class="hot-rank ' + rankClass + '">' + (i + 1) + '</span>' +
          '<span class="hot-item-title">' + escHtml(item.title) + '</span>' +
        '</div>';
      }).join('');
    } catch (e) {
      console.error('Hot error', e);
    }
  }

  // --- Feed header ---
  function updateFeedHeader() {
    const labels = { curated: '⭐ 精选', all: '📰 全部动态', hot: '🏆 热点排名' };
    let title = labels[currentMode] || '全部';
    if (currentCategory) title += ' · ' + currentCategory;
    if (currentQuery) title += ' · 搜索: ' + currentQuery;
    $('#feed-header').textContent = title;
  }

  // --- Navigation ---
  function initNav() {
    $$('.nav-item').forEach(el => {
      el.addEventListener('click', () => {
        $$('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
        currentMode = el.dataset.mode;
        currentCategory = '';
        currentPage = 1;
        $$('.nav-cat-item').forEach(c => c.classList.remove('active-cat'));
        loadItems();
      });
    });
    $$('.nav-cat-item').forEach(el => {
      el.addEventListener('click', () => {
        const isActive = el.classList.contains('active-cat');
        $$('.nav-cat-item').forEach(c => c.classList.remove('active-cat'));
        if (isActive) {
          currentCategory = '';
        } else {
          el.classList.add('active-cat');
          currentCategory = el.dataset.cat;
        }
        currentPage = 1;
        loadItems();
      });
    });
  }

  // --- Search ---
  function initSearch() {
    let debounce = null;
    $('#search-input').addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        currentQuery = e.target.value.trim();
        currentPage = 1;
        loadItems();
      }, 400);
    });
  }

  // --- Collect button ---
  function initCollect() {
    $('#collect-btn').addEventListener('click', async () => {
      const btn = $('#collect-btn');
      btn.disabled = true;
      btn.textContent = '⏳ 采集中...';
      try {
        const res = await fetch('/api/collect', { method: 'POST' });
        const data = await res.json();
        btn.textContent = '✅ 完成 (' + (data.unique || 0) + ')';
        loadItems();
        loadHot();
        loadStats();
      } catch (e) {
        btn.textContent = '❌ 失败';
      }
      setTimeout(() => { btn.disabled = false; btn.textContent = '🔄 采集'; }, 3000);
    });
  }

  // --- Pagination click ---
  function initPagination() {
    $('#pagination').addEventListener('click', (e) => {
      const btn = e.target.closest('.page-btn');
      if (!btn || btn.disabled) return;
      currentPage = parseInt(btn.dataset.p);
      loadItems();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // --- Mobile menu ---
  function initMenu() {
    $('#menu-btn').addEventListener('click', () => {
      $('#sidebar').classList.toggle('open');
    });
  }

  // --- Startup polling: try every 3s until data arrives ---
  function startupPoll() {
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const data = await fetchJSON('/api/items?mode=all&limit=1');
        if (data.total > 0 || attempts >= 20) {
          clearInterval(poll);
          loadItems();
          loadHot();
          loadStats();
        }
      } catch (e) { /* keep polling */ }
    }, 3000);
  }

  // --- Auto refresh every 60s ---
  function startAutoRefresh() {
    refreshTimer = setInterval(() => {
      loadItems();
      loadHot();
      loadStats();
    }, 120000);
  }

  // --- Init ---
  function init() {
    initNav();
    initSearch();
    initCollect();
    initPagination();
    initMenu();
    startupPoll();
    startAutoRefresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
