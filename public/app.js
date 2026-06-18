(function() {
  'use strict';
  let currentPage='curated',currentCategory='',currentSearch='',pageNum=1,ws=null,wsRetryCount=0,sidebarOpen=false,lastServerCollect='';
  const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);

  // ���� Chinese time display ����
  function timeAgo(d){
    if(!d)return'';
    const date=new Date(d);
    if(isNaN(date.getTime()))return'';
    const s=(Date.now()-date.getTime())/1000;
    if(s<0)return'刚刚';
    if(s<60)return Math.floor(s)+'秒前';
    if(s<3600)return Math.floor(s/60)+'分钟前';
    if(s<86400)return Math.floor(s/3600)+'小时前';
    if(s<604800)return Math.floor(s/86400)+'天前';
    return date.toLocaleDateString('zh-CN');
  }
  function fmtDate(d){return d?new Date(d).toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'short'}):''}
  function fmtTime(d){return d?new Date(d).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):''}
  function fmtFullTime(d){return d?new Date(d).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):''}
  function scls(s){return s>=70?'score-high':s>=50?'score-mid':'score-low'}
  function esc(s){return s?s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'):''}
  function toHtml(c){if(!c)return'<p style="color:var(--text-3)">暂无内容</p>';return c.split(/\n{2,}/).filter(p=>p.trim()).map(p=>'<p>'+esc(p.trim())+'</p>').join('')}

  // Auto-translate English content to Chinese on the client side


  // ���� Sidebar ����
  function openSidebar(){sidebarOpen=true;$('#sidebar').classList.add('open');$('#sidebar-overlay').classList.add('show');document.body.style.overflow='hidden'}
  function closeSidebar(){sidebarOpen=false;$('#sidebar').classList.remove('open');$('#sidebar-overlay').classList.remove('show');document.body.style.overflow=''}
  function toggleSidebar(){sidebarOpen?closeSidebar():openSidebar()}

  // ���� Theme ����
  function initTheme(){const m=localStorage.getItem('theme-mode')||'dark';applyTheme(m);$$('.theme-btn').forEach(b=>{b.classList.toggle('active',b.dataset.mode===m);b.onclick=()=>{const v=b.dataset.mode;localStorage.setItem('theme-mode',v);applyTheme(v);$$('.theme-btn').forEach(x=>x.classList.toggle('active',x.dataset.mode===v))}})}
  function applyTheme(m){let a=m;if(m==='auto')a=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.setAttribute('data-theme',a);document.documentElement.setAttribute('data-theme-mode',m)}

  // ���� Routing ����
  function handleRoute(){
    const h=location.hash||'#/',p=h.replace('#/','').split('/'),page=p[0]||'curated',cat=p[1]||'';
    if(page==='item'&&cat){showDetail(parseInt(cat));return}
    currentPage=page;currentCategory=cat;pageNum=1;
    $$('.side-link').forEach(l=>l.classList.toggle('active',l.dataset.page===page));
    $$('.side-cat-link').forEach(l=>l.classList.toggle('active',l.dataset.cat===cat));
    loadList();closeSidebar();
  }

  // ���� Trending Section ����
  async function loadTrending(){
    try{
      const r=await fetch('/api/trending');const d=await r.json();
      if(!d.items||!d.items.length)return '';
      let h='<div class="trending-section">';
      h+='<div class="trending-header"><span class="trending-icon">\u{1F525}</span><span class="trending-title">当前热点</span><span class="trending-count">'+d.items.length+' 条</span></div>';
      h+='<div class="trending-grid">';
      for(let i=0;i<Math.min(d.items.length,10);i++){
        const item=d.items[i];
        h+='<div class="trending-card" onclick="window.__openItem('+item.id+')">';
        h+='<span class="trending-rank">#'+(i+1)+'</span>';
        h+='<div class="trending-card-body">';
        h+='<div class="trending-card-title">'+esc(item.title)+'</div>';
        h+='<div class="trending-card-meta"><span>'+esc(item.source)+'</span><span class="trending-card-time">'+fmtFullTime(item.published_at)+'</span></div>';
        h+='</div>';
        if(item.score)h+='<span class="trending-score '+scls(item.score)+'">'+item.score+'</span>';
        h+='</div>';
      }
      h+='</div></div>';
      return h;
    }catch{return '';}
  }

  // ���� Load List ����
  async function loadList(){
    const area=$('#content-area');
    area.innerHTML='<div class="loading"><div class="spinner"></div>加载中...</div>';
    
    // Load trending section first
    let trendingHtml='';
    if(currentPage==='curated'&&!currentCategory&&!currentSearch){
      trendingHtml=await loadTrending();
    }
    
    let url='/api/items?mode='+currentPage+'&page='+pageNum+'&limit=30';
    if(currentCategory)url+='&category='+encodeURIComponent(currentCategory);
    if(currentSearch)url+='&q='+encodeURIComponent(currentSearch);
    try{
      const r=await fetch(url);const d=await r.json();
      renderTimeline(d.items,d.total,d.page,d.pages,trendingHtml);
    }catch{area.innerHTML='<div class="empty-state"><p>加载失败</p></div>'}
  }

  // ���� Render Timeline ����
  function renderTimeline(items,total,page,pages,trendingHtml){
    const area=$('#content-area');
    if(!items||!items.length&&!trendingHtml){area.innerHTML='<div class="empty-state"><p>正在采集中...</p></div>';return}
    
    let h=trendingHtml||'';
    
    if(items&&items.length){
      // Sort by collected_at DESC for timeline (most recently collected first)
      const sorted=[...items].sort((a,b)=>new Date(b.collected_at)-new Date(a.collected_at));
      
      const g={};
      for(const i of sorted){
        const d=i.collected_at?fmtDate(i.collected_at):(i.published_at?fmtDate(i.published_at):'未知');
        (g[d]=g[d]||[]).push(i);
      }
      for(const [day,di] of Object.entries(g)){
        h+='<div class="timeline-group"><div class="timeline-date">'+esc(day)+'</div>';
        for(const i of di){
          h+='<div class="timeline-item" onclick="window.__openItem('+i.id+')"><div class="timeline-body">';
          h+='<div class="timeline-head">';
          h+='<span class="timeline-source">'+esc(i.source)+'</span>';
          h+='<span class="timeline-time">'+fmtTime(i.published_at)+'</span>';
          if(i.collected_at)h+='<span class="timeline-collected">采集于 '+timeAgo(i.collected_at)+'</span>';
          if(i.is_curated)h+='<span class="curated-badge">精选</span>';
          h+='<span class="timeline-score '+scls(i.score)+'">'+i.score+'</span>';
          h+='</div>';
          h+='<div class="timeline-title">'+esc(i.title)+'</div>';
          if(i.summary)h+='<div class="timeline-summary">'+esc(i.summary)+'</div>';
          h+='</div></div>';
        }
        h+='</div>';
      }
    }
    
    if(pages>1){
      h+='<div class="pagination">';
      h+='<button class="page-btn" onclick="window.__goPage('+(page-1)+')" '+(page<=1?'disabled':'')+'>上一页</button>';
      for(let i=Math.max(1,page-2);i<=Math.min(pages,page+2);i++)h+='<button class="page-btn '+(i===page?'active':'')+'" onclick="window.__goPage('+i+')">'+i+'</button>';
      h+='<button class="page-btn" onclick="window.__goPage('+(page+1)+')" '+(page>=pages?'disabled':'')+'>下一页</button>';
      h+='</div>';
    }
    area.innerHTML=h;
  }

  // ���� Detail View ����
  async function showDetail(id){
    const ov=$('#detail-overlay'),bd=$('#detail-body');
    ov.classList.add('open');document.body.style.overflow='hidden';
    bd.innerHTML='<div class="loading"><div class="spinner"></div>加载中...</div>';
    try{
      const r=await fetch('/api/items/'+id);const d=await r.json();const i=d.item,rel=d.related||[];
      const ext=$('#detail-ext-link');
      if(i.link){ext.href=i.link;ext.style.display=''}else{ext.style.display='none'}
      let h='';
      h+='<div class="detail-source"><span>'+esc(i.source)+'</span>';
      if(i.published_at)h+='<span> · '+fmtFullTime(i.published_at)+'</span>';
      if(i.is_curated)h+='<span class="curated-badge">精选</span>';
      h+='<span class="timeline-score '+scls(i.score)+'">'+i.score+'</span></div>';
      h+='<h1 class="detail-title">'+esc(i.title)+'</h1>';
      h+='<div class="detail-meta">';
      if(i.published_at)h+='<span>发布: '+new Date(i.published_at).toLocaleString('zh-CN')+'</span>';
      if(i.collected_at)h+='<span> | </span><span>采集: '+new Date(i.collected_at).toLocaleString('zh-CN')+'</span>';
      h+='<span> | </span><span>'+esc(i.source)+'</span></div>';
      if(i.image_url)h+='<img class="detail-image" src="'+esc(i.image_url)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'" />';
      if(i.summary_analysis){h+='<div class="detail-summary"><div class="detail-summary-label">\u{1F4DD} \u8D44\u8BAF\u6458\u8981</div><p>'+esc(i.summary_analysis)+'</p></div>';}
      if(i.impact){h+='<div class="detail-impact"><div class="detail-impact-label">\u{1F4CA} \u5F71\u54CD\u5206\u6790</div><p>'+esc(i.impact)+'</p></div>';}
      h+='<div class="detail-content">'+toHtml(i.content||i.summary)+'</div>';
      if(rel.length>0){h+='<div class="detail-related"><div class="detail-related-title">相关报道</div>';rel.forEach(r=>{h+='<div class="related-item" onclick="window.__openItem('+r.id+')"><span class="related-item-title">'+esc(r.title)+'</span><span class="related-item-meta">'+esc(r.source)+'</span></div>'});h+='</div>'}
      bd.innerHTML=h;
      // Auto-translate English content
      const contentEl = bd.querySelector('.detail-content');
    }catch{bd.innerHTML='<div class="empty-state"><p>加载失败</p></div>'}
  }
  function closeDetail(){$('#detail-overlay').classList.remove('open');document.body.style.overflow='';if(location.hash.startsWith('#/item/'))history.back()}

  function shareItem(){const t=document.querySelector('.detail-title')?.textContent||'';const l=$('#detail-ext-link')?.href||location.href;if(navigator.share){navigator.share({title:t,url:l}).catch(()=>{})}else{navigator.clipboard?.writeText(l);const b=$('#btn-share');b.textContent='已复制';setTimeout(()=>{b.textContent='分享'},1500)}}

  // ���� WebSocket ����
  function connectWS(){
    const proto=location.protocol==='https:'?'wss:':'ws:';
    try{ws=new WebSocket(proto+'//'+location.host)}catch{return}
    ws.onopen=()=>{wsRetryCount=0;$('#ws-status').classList.remove('off');$('#ws-status').title='实时连接中'};
    ws.onmessage=e=>{
      try{
        const d=JSON.parse(e.data);
        if(d.type==='new_items'&&d.items?.length>0){
          showToast(d.count||d.items.length);
        }
        if(d.type==='heartbeat'){
          lastServerCollect=d.lastCollect||lastServerCollect;
          updateLiveIndicator(d);
        }
      }catch{}
    };
    ws.onclose=()=>{$('#ws-status').classList.add('off');$('#ws-status').title='连接断开';const dl=Math.min(30000,1000*Math.pow(2,wsRetryCount++));setTimeout(connectWS,dl)};
    ws.onerror=()=>ws.close();
  }

  // ���� Toast ����
  function showToast(count){
    document.querySelector('.new-toast')?.remove();
    const t=document.createElement('div');
    t.className='new-toast';
    t.innerHTML='<span class="toast-pulse"></span> '+count+' 条新热点，刷新中...';
    document.body.appendChild(t);
    setTimeout(()=>{t.remove();loadList();loadStats()},2000);
    t.onclick=()=>{t.remove();loadList();loadStats()};
    setTimeout(()=>t.remove(),15000);
  }

  // ���� Live Indicator ����
  function updateLiveIndicator(data){
    const el=$('#live-indicator');
    if(!el)return;
    const ago=timeAgo(data.serverTime||new Date().toISOString());
    const collectAgo=data.lastCollect?timeAgo(data.lastCollect):'未知';
    el.innerHTML='<span class="live-dot"></span> 实时更新中 · 上次采集: '+collectAgo;
    el.classList.add('active');
  }

  // ���� Stats ����
  async function loadStats(){
    try{
      const d=await(await fetch('/api/stats')).json();
      const el=$('#stats-info');
      if(el)el.textContent=d.total+' 条资讯 · 今日 '+d.today+' · '+d.sources+' 源';
      const nav=$('#category-nav');nav.innerHTML='';
      for(const c of d.categories){
        const a=document.createElement('a');a.className='side-cat-link';a.dataset.cat=c.category;
        a.textContent=c.category+' ('+c.cnt+')';a.href='#/cat/'+c.category;
        a.onclick=e=>{e.preventDefault();currentPage='all';currentCategory=c.category;pageNum=1;location.hash='#/cat/'+c.category;closeSidebar();loadList()};
        nav.appendChild(a);
      }
    }catch{}
  }

  // ���� Last Update Indicator ����
  async function loadLastUpdate(){
    try{
      const d=await(await fetch('/api/last-update')).json();
      const el=$('#last-update-info');
      if(el&&d.lastUpdate){
        const ago=timeAgo(d.lastUpdate);
        const t=new Date(d.lastUpdate).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
        el.innerHTML='最近更新: <strong>'+t+'</strong> ('+ago+') · 近1小时新增 '+d.recentCount1h+' 条';
        el.style.display='';
      }
      // Update live indicator
      const li=$('#live-indicator');
      if(li&&d.lastUpdate){
        li.innerHTML='<span class="live-dot"></span> 实时更新中 · 上次采集: '+timeAgo(d.lastUpdate);
      }
    }catch{}
  }

  window.__openItem=id=>{location.hash='#/item/'+id};
  window.__goPage=p=>{pageNum=p;loadList();$('#content-area').scrollTop=0};

  // ���� Init ����
  document.addEventListener('DOMContentLoaded',()=>{
    initTheme();connectWS();loadStats();loadLastUpdate();
    window.addEventListener('hashchange',handleRoute);handleRoute();
    
    // Search
    let timer;$('#search-input').addEventListener('input',e=>{clearTimeout(timer);timer=setTimeout(()=>{currentSearch=e.target.value.trim();pageNum=1;loadList()},400)});
    
    // Detail
    $('#detail-back').onclick=closeDetail;
    $('#detail-overlay').onclick=e=>{if(e.target===$('#detail-overlay'))closeDetail()};
    $('#btn-share').onclick=shareItem;
    
    // Keyboard
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#detail-overlay').classList.contains('open'))closeDetail();else if(sidebarOpen)closeSidebar()}});
    
    // Sidebar - toggle on button click
    $('#menu-toggle').onclick=toggleSidebar;
    // Sidebar - close on overlay click (mobile fix)
    $('#sidebar-overlay').onclick=closeSidebar;
    
    // Collect button
    $('#btn-collect').onclick=async()=>{
      const b=$('#btn-collect');
      b.disabled=true;
      b.innerHTML='<span class="btn-spinner"></span> 采集中...';
      try{
        const r=await fetch('/api/collect',{method:'POST'});
        const d=await r.json();
        showToast(0);
      }catch{}
      setTimeout(()=>{b.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> 刷新';b.disabled=false},5000);
      setTimeout(()=>{loadList();loadStats()},8000);
    };
    
    // Auto-refresh: poll every 30s for new data
    // Auto-refresh disabled to prevent flickering - use visibility change + manual refresh instead
    setInterval(loadStats,60000);
    // Last update indicator refreshes every 10s
    setInterval(loadLastUpdate,10000);
    
    // Refresh on tab focus
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){loadList();loadStats();loadLastUpdate()}});
  });
})();
