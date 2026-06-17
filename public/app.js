(function() {
  'use strict';
  let currentPage='curated',currentCategory='',currentSearch='',pageNum=1,ws=null,wsRetryCount=0,sidebarOpen=false;
  const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);

  function timeAgo(d){
    if(!d)return'';
    const date=new Date(d);
    if(isNaN(date.getTime()))return'';
    const s=(Date.now()-date.getTime())/1000;
    if(s<60)return'just now';
    if(s<3600)return Math.floor(s/60)+'m ago';
    if(s<86400)return Math.floor(s/3600)+'h ago';
    if(s<604800)return Math.floor(s/86400)+'d ago';
    return date.toLocaleDateString('zh-CN');
  }
  function fmtDate(d){return d?new Date(d).toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'short'}):''}
  function fmtTime(d){return d?new Date(d).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):''}
  function scls(s){return s>=70?'score-high':s>=50?'score-mid':'score-low'}
  function esc(s){return s?s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'):''}
  function toHtml(c){if(!c)return'<p style="color:var(--text-3)">No content</p>';return c.split(/\n{2,}/).filter(p=>p.trim()).map(p=>'<p>'+esc(p.trim())+'</p>').join('')}

  function openSidebar(){sidebarOpen=true;$('#sidebar').classList.add('open');$('#sidebar-overlay').classList.add('show');document.body.style.overflow='hidden'}
  function closeSidebar(){sidebarOpen=false;$('#sidebar').classList.remove('open');$('#sidebar-overlay').classList.remove('show');document.body.style.overflow=''}
  function toggleSidebar(){sidebarOpen?closeSidebar():openSidebar()}

  function initTheme(){const m=localStorage.getItem('theme-mode')||'dark';applyTheme(m);$$('.theme-btn').forEach(b=>{b.classList.toggle('active',b.dataset.mode===m);b.onclick=()=>{const v=b.dataset.mode;localStorage.setItem('theme-mode',v);applyTheme(v);$$('.theme-btn').forEach(x=>x.classList.toggle('active',x.dataset.mode===v))}})}
  function applyTheme(m){let a=m;if(m==='auto')a=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.setAttribute('data-theme',a);document.documentElement.setAttribute('data-theme-mode',m)}

  function handleRoute(){
    const h=location.hash||'#/',p=h.replace('#/','').split('/'),page=p[0]||'curated',cat=p[1]||'';
    if(page==='item'&&cat){showDetail(parseInt(cat));return}
    currentPage=page;currentCategory=cat;pageNum=1;
    $$('.side-link').forEach(l=>l.classList.toggle('active',l.dataset.page===page));
    $$('.side-cat-link').forEach(l=>l.classList.toggle('active',l.dataset.cat===cat));
    loadList();closeSidebar();
  }

  async function loadList(){
    const area=$('#content-area');
    area.innerHTML='<div class="loading"><div class="spinner"></div>Loading...</div>';
    let url='/api/items?mode='+currentPage+'&page='+pageNum+'&limit=30';
    if(currentCategory)url+='&category='+encodeURIComponent(currentCategory);
    if(currentSearch)url+='&q='+encodeURIComponent(currentSearch);
    try{const r=await fetch(url);const d=await r.json();renderTimeline(d.items,d.total,d.page,d.pages)}
    catch{area.innerHTML='<div class="empty-state"><p>Failed to load</p></div>'}
  }

  function renderTimeline(items,total,page,pages){
    const area=$('#content-area');
    if(!items||!items.length){area.innerHTML='<div class="empty-state"><p>Collecting...</p></div>';return}
    const g={};
    for(const i of items){const d=i.published_at?fmtDate(i.published_at):'Unknown';(g[d]=g[d]||[]).push(i)}
    let h='';
    for(const [day,di] of Object.entries(g)){
      h+='<div class="timeline-group"><div class="timeline-date">'+esc(day)+'</div>';
      for(const i of di){
        h+='<div class="timeline-item" onclick="window.__openItem('+i.id+')"><div class="timeline-body">';
        h+='<div class="timeline-head">';
        h+='<span class="timeline-source">'+esc(i.source)+'</span>';
        h+='<span class="timeline-time">'+fmtTime(i.published_at)+'</span>';
        if(i.collected_at)h+='<span class="timeline-collected">collected '+timeAgo(i.collected_at)+'</span>';
        if(i.is_curated)h+='<span class="curated-badge">curated</span>';
        h+='<span class="timeline-score '+scls(i.score)+'">'+i.score+'</span>';
        h+='</div>';
        h+='<div class="timeline-title">'+esc(i.title)+'</div>';
        if(i.summary)h+='<div class="timeline-summary">'+esc(i.summary)+'</div>';
        h+='</div></div>';
      }
      h+='</div>';
    }
    if(pages>1){
      h+='<div class="pagination">';
      h+='<button class="page-btn" onclick="window.__goPage('+(page-1)+')" '+(page<=1?'disabled':'')+'>prev</button>';
      for(let i=Math.max(1,page-2);i<=Math.min(pages,page+2);i++)h+='<button class="page-btn '+(i===page?'active':'')+'" onclick="window.__goPage('+i+')">'+i+'</button>';
      h+='<button class="page-btn" onclick="window.__goPage('+(page+1)+')" '+(page>=pages?'disabled':'')+'>next</button>';
      h+='</div>';
    }
    area.innerHTML=h;
  }

  async function showDetail(id){
    const ov=$('#detail-overlay'),bd=$('#detail-body');
    ov.classList.add('open');document.body.style.overflow='hidden';
    bd.innerHTML='<div class="loading"><div class="spinner"></div>Loading...</div>';
    try{
      const r=await fetch('/api/items/'+id);const d=await r.json();const i=d.item,rel=d.related||[];
      const ext=$('#detail-ext-link');
      if(i.link){ext.href=i.link;ext.style.display=''}else{ext.style.display='none'}
      let h='';
      h+='<div class="detail-source"><span>'+esc(i.source)+'</span><span> - </span><span>'+timeAgo(i.published_at)+'</span>';
      if(i.is_curated)h+='<span class="curated-badge">curated</span>';
      h+='<span class="timeline-score '+scls(i.score)+'">'+i.score+'</span></div>';
      h+='<h1 class="detail-title">'+esc(i.title)+'</h1>';
      h+='<div class="detail-meta">';
      h+='<span>Published: '+(i.published_at?new Date(i.published_at).toLocaleString('zh-CN'):'')+'</span>';
      h+='<span> | </span><span>Collected: '+(i.collected_at?new Date(i.collected_at).toLocaleString('zh-CN'):'')+'</span>';
      h+='<span> | </span><span>'+esc(i.source)+'</span></div>';
      if(i.reason)h+='<div class="detail-reason"><div class="detail-reason-label">Recommendation</div><div class="detail-reason-text">'+esc(i.reason)+'</div></div>';
      if(i.image_url)h+='<img class="detail-image" src="'+esc(i.image_url)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'" />';
      h+='<div class="detail-content">'+toHtml(i.content||i.summary)+'</div>';
      if(i.tags&&i.tags!=='[]'){try{const t=JSON.parse(i.tags);if(t.length){h+='<div class="detail-tags">';t.forEach(x=>{h+='<span class="detail-tag">'+esc(x)+'</span>'});h+='</div>'}}catch{}}
      if(rel.length>0){h+='<div class="detail-related"><div class="detail-related-title">Related</div>';rel.forEach(r=>{h+='<div class="related-item" onclick="window.__openItem('+r.id+')"><span class="related-item-title">'+esc(r.title)+'</span><span class="related-item-meta">'+esc(r.source)+'</span></div>'});h+='</div>'}
      bd.innerHTML=h;
    }catch{bd.innerHTML='<div class="empty-state"><p>Failed to load</p></div>'}
  }
  function closeDetail(){$('#detail-overlay').classList.remove('open');document.body.style.overflow='';if(location.hash.startsWith('#/item/'))history.back()}

  function shareItem(){const t=document.querySelector('.detail-title')?.textContent||'';const l=$('#detail-ext-link')?.href||location.href;if(navigator.share){navigator.share({title:t,url:l}).catch(()=>{})}else{navigator.clipboard?.writeText(l);const b=$('#btn-share');b.textContent='Copied';setTimeout(()=>{b.textContent='Share'},1500)}}

  function connectWS(){
    const proto=location.protocol==='https:'?'wss:':'ws:';
    try{ws=new WebSocket(proto+'//'+location.host)}catch{return}
    ws.onopen=()=>{wsRetryCount=0;$('#ws-status').classList.remove('off');$('#ws-status').title='Live connected'};
    ws.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.type==='new_items'&&d.items?.length>0)showToast(d.items.length)}catch{}};
    ws.onclose=()=>{$('#ws-status').classList.add('off');const dl=Math.min(30000,1000*Math.pow(2,wsRetryCount++));setTimeout(connectWS,dl)};
    ws.onerror=()=>ws.close();
  }

  function showToast(count){
    document.querySelector('.new-toast')?.remove();
    const t=document.createElement('div');
    t.className='new-toast';
    t.textContent=count+' new items, refreshing...';
    document.body.appendChild(t);
    setTimeout(()=>{t.remove();loadList();loadStats()},2000);
    t.onclick=()=>{t.remove();loadList();loadStats()};
    setTimeout(()=>t.remove(),12000);
  }

  async function loadStats(){
    try{
      const d=await(await fetch('/api/stats')).json();
      $('#stats-info').textContent=d.total+' items today '+d.today+' '+d.sources+' sources';
      const nav=$('#category-nav');nav.innerHTML='';
      for(const c of d.categories){
        const a=document.createElement('a');a.className='side-cat-link';a.dataset.cat=c.category;
        a.textContent=c.category+' ('+c.cnt+')';a.href='#/cat/'+c.category;
        a.onclick=e=>{e.preventDefault();currentPage='all';currentCategory=c.category;pageNum=1;location.hash='#/cat/'+c.category;closeSidebar();loadList()};
        nav.appendChild(a);
      }
    }catch{}
  }

  window.__openItem=id=>{location.hash='#/item/'+id};
  window.__goPage=p=>{pageNum=p;loadList();$('#content-area').scrollTop=0};

  
  async function loadLastUpdate(){
    try{
      const d=await(await fetch('/api/last-update')).json();
      const el=$('#last-update-info');
      if(el&&d.lastUpdate){
        const ago=timeAgo(d.lastUpdate);
        el.textContent='Last updated: '+ago+' ('+d.recentCount+' new in 5min)';
        el.style.display='';
      }
    }catch{}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    initTheme();connectWS();loadStats();loadLastUpdate();
    window.addEventListener('hashchange',handleRoute);handleRoute();
    let timer;$('#search-input').addEventListener('input',e=>{clearTimeout(timer);timer=setTimeout(()=>{currentSearch=e.target.value.trim();pageNum=1;loadList()},400)});
    $('#detail-back').onclick=closeDetail;
    $('#detail-overlay').onclick=e=>{if(e.target===$('#detail-overlay'))closeDetail()};
    $('#btn-share').onclick=shareItem;
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#detail-overlay').classList.contains('open'))closeDetail();else if(sidebarOpen)closeSidebar()}});
    $('#menu-toggle').onclick=toggleSidebar;
    $('#sidebar-overlay').onclick=closeSidebar;
    $('#btn-collect').onclick=async()=>{
      const b=$('#btn-collect');
      b.disabled=true;
      b.textContent='Collecting...';
      try{fetch('/api/collect',{method:'POST'})}catch{}
      setTimeout(()=>{b.textContent='Refresh';b.disabled=false},8000);
      setTimeout(()=>{loadList();loadStats()},12000);
    };
    setInterval(()=>{loadList()},60000);
    setInterval(loadStats,60000); setInterval(loadLastUpdate,30000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){loadList();loadStats()}});
  });
})();