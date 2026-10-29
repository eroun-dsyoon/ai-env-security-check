/* ============================================================
   12. 화면 라우팅 · 진행률
   ============================================================ */
const VIEWS = ['intro','inventory','common','assess','tech','result'];

function show(view){
  if(!VIEWS.includes(view)) view = 'intro';
  if(view === 'assess' && !state.envs.length) view = 'inventory';
  if((view === 'tech' || view === 'result') && !state.envs.length) view = 'inventory';
  state.view = view;
  VIEWS.forEach(v => { const el = $('view-' + v); if(el) el.hidden = (v !== view); });
  if(view === 'inventory'){ renderCatalog(); renderCustom(); paintInv(); }
  if(view === 'common'){ renderCommon(); }
  if(view === 'assess'){
    if(state.idx >= state.envs.length) state.idx = Math.max(0, state.envs.length - 1);
    renderEnvTabs(); renderAssess();
  }
  if(view === 'tech'){ renderTech(); }
  if(view === 'result'){ renderResult(); }
  paintProgress();
  save();
  window.scrollTo({top:0, behavior:'auto'});
}

function paintRail(){
  const rail = $('rail'); if(!rail) return;
  const order = VIEWS;
  const cur = order.indexOf(state.view);
  const doneMap = {
    inventory: state.envs.length > 0,
    common: COMMON_ITEMS.every(it => state.common[it.id]),
    assess: state.envs.length > 0 && state.envs.every(e => envStats(e.uid).complete),
    tech: state.envs.length > 0 && techNeeds().filter(r => r.level > 0).every(r => state.tech[r.tech.id]?.s),
    result: false
  };
  rail.querySelectorAll('[data-goto]').forEach(a => {
    const v = a.dataset.goto;
    const i = order.indexOf(v);
    a.classList.toggle('on', v === state.view);
    a.classList.toggle('done', i < cur || (i !== cur && doneMap[v] === true));
    if(v === 'assess' || v === 'tech' || v === 'result') a.hidden = !state.envs.length;
  });
}

function paintProgress(){
  const inv = state.envs.length ? 1 : 0;
  const cDone = COMMON_ITEMS.filter(it => state.common[it.id]).length;
  let eDone = 0, eTot = 0;
  state.envs.forEach(e => {
    const p = state.profiles[e.uid] || {};
    const items = itemsFor(e.typeId);
    eDone += PROFILE_Q.filter(q => p[q.id] !== undefined).length;
    eDone += items.filter(it => state.answers[e.uid]?.[it.id]).length;
    eTot += PROFILE_Q.length + items.length;
  });
  const needed = state.envs.length ? techNeeds().filter(r => r.level > 0) : [];
  const tDone = needed.filter(r => state.tech[r.tech.id]?.s).length;
  const tot = 1 + COMMON_ITEMS.length + eTot + needed.length;
  const p = tot ? Math.min(100, Math.round((inv + cDone + eDone + tDone) / tot * 100)) : 0;
  const fill = $('pbarFill'), txt = $('pbarText');
  if(fill) fill.style.width = p + '%';
  if(txt) txt.textContent = p + '%';
  paintRail();
}

/* ============================================================
   13. 환경 추가 (목록에 없는 경우)
   ============================================================ */
let customFormOpen = false;

function renderCustomForm(){
  return `
  <div class="card" id="customForm" style="border-color:#bfdbfe;background:#f8fbff">
    <h2 class="cardt">목록에 없는 환경 추가</h2>
    <p class="hint" style="margin-bottom:10px">사내에서만 쓰는 시스템·도구라면 가장 비슷한 범주를 고르세요. 그 범주의 통제·이슈 항목이 자동 적용됩니다.</p>
    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:10px">
      <label style="font-size:12.5px;color:var(--muted)">환경 이름
        <input id="cfName" type="text" placeholder="예: 사내 계약서 검토 AI" aria-label="추가할 환경 이름"
          style="display:block;width:100%;margin-top:4px;padding:9px 11px;border:1px solid var(--line2);border-radius:9px;font:inherit;font-size:13.5px">
      </label>
      <label style="font-size:12.5px;color:var(--muted)">범주
        <select id="cfCat" aria-label="추가할 환경의 범주"
          style="display:block;width:100%;margin-top:4px;padding:9px 11px;border:1px solid var(--line2);border-radius:9px;font:inherit;font-size:13.5px;background:#fff">
          ${CATEGORIES.map(c => `<option value="${c.id}">${esc(c.name)} — ${esc(c.desc)}</option>`).join('')}
        </select>
      </label>
    </div>
    <label style="display:block;font-size:12.5px;color:var(--muted);margin-top:9px">설명 (선택)
      <input id="cfDesc" type="text" placeholder="무엇에 쓰이고 어떤 데이터를 다루나요?" aria-label="추가할 환경 설명"
        style="display:block;width:100%;margin-top:4px;padding:9px 11px;border:1px solid var(--line2);border-radius:9px;font:inherit;font-size:13.5px">
    </label>
    <div class="btn-row" style="margin-top:12px">
      <button class="btn" id="cfSave" type="button">추가하고 선택</button>
      <button class="btn-ghost" id="cfCancel" type="button">취소</button>
    </div>
  </div>`;
}

function bindCustomForm(){
  const saveBtn = $('cfSave'), cancel = $('cfCancel');
  if(cancel) cancel.addEventListener('click', () => { customFormOpen = false; renderCustom(); });
  if(!saveBtn) return;
  saveBtn.addEventListener('click', () => {
    const name = ($('cfName').value || '').trim();
    if(!name){ toast('환경 이름을 입력하세요'); $('cfName').focus(); return; }
    const cat = $('cfCat').value;
    const desc = ($('cfDesc').value || '').trim();
    const id = 'X' + Date.now().toString(36).toUpperCase();
    state.custom.push({id, cat, name, desc, eg:'', key:'사내 고유 환경 — 유형별 구조 위험을 직접 조정하세요', baseRisk:0.6, flag:true, custom:true});
    state.envs.push({uid: uidFor(id), typeId: id, name, owner:'', users:'', note:''});
    customFormOpen = false;
    renderCatalog(); renderCustom(); paintInv(); save();
    toast('“' + name + '” 환경을 추가했습니다');
    window.scrollTo({top:0, behavior:'smooth'});
  });
}
