
/* ============================================================
   11-1. 용어 도움말 — 본문 용어 옆에 ? 버튼을 붙이고 설명 팝업을 띄운다
   같은 용어는 한 블록(항목·카드·표의 행) 안에서 처음 한 번만 표시
   ============================================================ */
const GLOSS_BY_ID = Object.fromEntries(GLOSSARY.map(g => [g.id, g]));
const HELP_MAP = {};
GLOSSARY.forEach(g => [g.term, ...(g.alias || [])].forEach(a => { if(!(a in HELP_MAP)) HELP_MAP[a] = g.id; }));
const HELP_RE = new RegExp(Object.keys(HELP_MAP)
  .sort((a, b) => b.length - a.length)
  .map(a => {
    const e = a.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    return (/^[A-Za-z0-9]/.test(a) ? '(?<![A-Za-z0-9])' : '') + e + (/[A-Za-z0-9]$/.test(a) ? '(?![A-Za-z0-9])' : '');
  }).join('|'), 'g');
const HELP_SKIP = 'button, .help, script, style, select, option, textarea, input, h1, code, .no-help, #helpPop, dialog';
const HELP_BLOCK = '.item, .q, .env, .gap, .rm, .kpi, .alert, tr, .cat-head, .section-head, .step-list li, .card, section';
const helpSeen = new WeakMap();

function helpBtn(id){
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'help'; b.dataset.help = id; b.textContent = '?';
  b.setAttribute('aria-label', '용어 설명: ' + GLOSS_BY_ID[id].term);
  b.setAttribute('aria-expanded', 'false');
  return b;
}

function helpify(root){
  if(!root || !root.isConnected) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n){
      if(!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement;
      if(!p || p.closest(HELP_SKIP)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while(walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => {
    const text = n.nodeValue;
    const block = n.parentElement.closest(HELP_BLOCK) || n.parentElement;
    let seen = helpSeen.get(block);
    if(!seen){ seen = new Set(); helpSeen.set(block, seen); }
    let m, last = 0, frag = null;
    HELP_RE.lastIndex = 0;
    while((m = HELP_RE.exec(text))){
      const id = HELP_MAP[m[0]];
      if(!id || seen.has(id)) continue;
      seen.add(id);
      frag = frag || document.createDocumentFragment();
      const end = m.index + m[0].length;
      frag.appendChild(document.createTextNode(text.slice(last, end)));
      frag.appendChild(helpBtn(id));
      last = end;
    }
    if(frag){
      frag.appendChild(document.createTextNode(text.slice(last)));
      n.parentNode.replaceChild(frag, n);
    }
  });
}

let helpOpenBtn = null;
function openHelp(btn){
  const g = GLOSS_BY_ID[btn.dataset.help]; if(!g) return;
  const pop = $('helpPop');
  pop.querySelector('.hp-t').textContent = g.term;
  pop.querySelector('.hp-d').textContent = g.d;
  pop.hidden = false;
  if(helpOpenBtn) helpOpenBtn.setAttribute('aria-expanded', 'false');
  helpOpenBtn = btn; btn.setAttribute('aria-expanded', 'true');
  const r = btn.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let top = r.bottom + 8;
  if(top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
  const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
  pop.style.top = top + 'px'; pop.style.left = left + 'px';
}
function closeHelp(){
  const pop = $('helpPop');
  if(!pop || pop.hidden) return;
  pop.hidden = true;
  if(helpOpenBtn){ helpOpenBtn.setAttribute('aria-expanded', 'false'); helpOpenBtn = null; }
}

function openGlossary(q){
  const dlg = $('glossDlg');
  const inp = $('glossQ');
  inp.value = q || '';
  renderGlossary(inp.value);
  if(!dlg.open) dlg.showModal();
  inp.focus();
}
function renderGlossary(q){
  const k = (q || '').trim().toLowerCase();
  const list = GLOSSARY
    .filter(g => !k || (g.term + ' ' + (g.alias || []).join(' ') + ' ' + g.d).toLowerCase().includes(k))
    .sort((a, b) => a.term.localeCompare(b.term, 'ko'));
  $('glossList').innerHTML = list.length
    ? list.map(g => `<div class="gl-row"><b>${esc(g.term)}</b><span>${esc(g.d)}</span></div>`).join('')
    : '<div class="empty">찾는 용어가 없습니다.</div>';
}

function startHelp(){
  const main = $('main');
  helpify(main);
  const obs = new MutationObserver(muts => {
    obs.disconnect();
    const roots = new Set();
    muts.forEach(m => m.addedNodes.forEach(n => {
      if(n.nodeType === 1) roots.add(n);
      else if(n.nodeType === 3 && n.parentElement) roots.add(n.parentElement);
    }));
    roots.forEach(helpify);
    obs.observe(main, {childList:true, subtree:true});
  });
  obs.observe(main, {childList:true, subtree:true});

  // 캡처 단계에서 처리해야 label 안의 ? 버튼이 체크박스·라디오를 바꾸지 않는다
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('.help');
    if(b){
      ev.preventDefault(); ev.stopPropagation();
      if(helpOpenBtn === b) closeHelp(); else openHelp(b);
      return;
    }
    if(!(ev.target.closest && ev.target.closest('#helpPop'))) closeHelp();
  }, true);
  document.addEventListener('keydown', (ev) => { if(ev.key === 'Escape') closeHelp(); });
  window.addEventListener('scroll', closeHelp, {passive:true});
  window.addEventListener('resize', closeHelp);

  $('hpMore').addEventListener('click', () => {
    const g = helpOpenBtn && GLOSS_BY_ID[helpOpenBtn.dataset.help];
    closeHelp();
    openGlossary(g ? g.term.replace(/ \(.*\)$/, '') : '');
  });
  $('glossQ').addEventListener('input', (ev) => renderGlossary(ev.target.value));
  $('glossClose').addEventListener('click', () => $('glossDlg').close());
}
