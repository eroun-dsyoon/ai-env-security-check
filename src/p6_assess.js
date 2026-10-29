/* ============================================================
   8. 2단계 — 전사 공통 통제
   ============================================================ */
function itemHTML(it, cur, prefix){
  const selCls = (k) => cur === k ? 'sel-' + ({yes:'y',part:'p',no:'n',unknown:'x'}[k]) : '';
  const showGuide = (cur === 'no' || cur === 'unknown');
  return `
  <div class="item" data-item="${it.id}">
    <div class="item-head">
      <div class="item-title">${esc(it.t)}${it.w===3?'<span class="crit">필수</span>':''}</div>
      <div class="item-ref">${it.id}</div>
    </div>
    ${descHTML(it.id)}
    <div class="ans">
      ${ANSWERS.map(a => `<label class="${selCls(a.k)}"><input type="radio" name="${prefix}${it.id}" value="${a.k}" ${cur===a.k?'checked':''}>${a.label}</label>`).join('')}
    </div>
    <div class="evidence"><b>증적</b><span>${esc(it.ev)}</span></div>
    <div class="item-guide ${showGuide?'show':''}"><b>채우는 방법 —</b> ${esc(it.fix)}</div>
    <div class="item-foot">
      <button class="link-btn" type="button">${showGuide?'가이드 접기':'이 항목을 채우려면?'}</button>
    </div>
  </div>`;
}

function descHTML(id){
  const x = DESC[id]; if(!x) return '';
  return `<div class="item-desc">
    <p><b>무엇을 점검하나</b>${esc(x.d)}</p>
    ${x.ok ? `<p><b>‘예’로 답하는 기준</b>${esc(x.ok)}</p>` : ''}
  </div>`;
}

function bindItems(host, onChange){
  host.querySelectorAll('.item input[type=radio]').forEach(inp => {
    inp.addEventListener('change', () => {
      const row = inp.closest('.item');
      const itemId = row.dataset.item;
      row.querySelectorAll('.ans label').forEach(lb => {
        lb.className = '';
        const r = lb.querySelector('input');
        if(r.checked) lb.classList.add('sel-' + ({yes:'y',part:'p',no:'n',unknown:'x'}[r.value]));
      });
      const a = inp.value;
      const g = row.querySelector('.item-guide');
      const b = row.querySelector('.link-btn');
      if(a === 'no' || a === 'unknown'){ g?.classList.add('show'); if(b) b.textContent='가이드 접기'; }
      else { g?.classList.remove('show'); if(b) b.textContent='이 항목을 채우려면?'; }
      onChange(itemId, a);
    });
  });
  host.querySelectorAll('.link-btn').forEach(b => {
    b.addEventListener('click', () => {
      const g = b.closest('.item').querySelector('.item-guide');
      g.classList.toggle('show');
      b.textContent = g.classList.contains('show') ? '가이드 접기' : '이 항목을 채우려면?';
    });
  });
}

function syncCommonBar(host, n){
  const chip = host.querySelector('.card-tight .chip');
  if(chip){
    const done = n === COMMON_ITEMS.length;
    chip.textContent = done ? '완료' : '진행 중';
    chip.className = 'chip ' + (done ? 'ok' : 'info');
  }
}

function renderCommon(){
  const host = $('commonHost');
  const answered = Object.keys(state.common).length;
  host.innerHTML = `
  <div class="card card-tight" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
    <div style="font-size:13px;color:var(--ink2)">전사 공통 <b style="font-size:16px;color:#0f172a">${answered}/${COMMON_ITEMS.length}</b> 응답</div>
    <div style="flex:1;min-width:140px"><div class="bar"><i style="width:${answered/COMMON_ITEMS.length*100}%;background:#2563eb"></i></div></div>
    <span class="chip ${answered===COMMON_ITEMS.length?'ok':'info'}">${answered===COMMON_ITEMS.length?'완료':'진행 중'}</span>
  </div>
  <div class="card">
    <h2 class="cardt">환경과 무관하게 한 번만 확인하는 항목</h2>
    <p class="hint" style="margin-bottom:4px">여기서 ‘아니오’가 나오면 개별 환경 통제가 좋아도 조직 전체 점수가 제한됩니다. ‘예’는 기준을 모두 갖춘 경우, ‘부분’은 일부만 갖춘 경우, ‘아니오’는 없는 경우, ‘모름’은 확인하지 못한 경우입니다.</p>
    ${COMMON_ITEMS.map(it => itemHTML(it, state.common[it.id], 'cm_')).join('')}
  </div>`;

  bindItems(host, (id, a) => {
    state.common[id] = a;
    save();
    const n = Object.keys(state.common).length;
    const bar = host.querySelector('.bar i');
    if(bar) bar.style.width = (n/COMMON_ITEMS.length*100) + '%';
    const lab = host.querySelector('.card-tight div b');
    if(lab) lab.textContent = `${n}/${COMMON_ITEMS.length}`;
    $('commonFoot').textContent = `${n} / ${COMMON_ITEMS.length} 항목`;
    syncCommonBar(host, n);
    paintProgress();
  });
  $('commonFoot').textContent = `${answered} / ${COMMON_ITEMS.length} 항목`;
}

/* ============================================================
   9. 3단계 — 환경별 점검
   ============================================================ */
function envStats(uid){
  const env = envOf(uid); if(!env) return null;
  const items = itemsFor(env.typeId);
  let got = 0, tot = 0, done = 0;
  items.forEach(it => {
    const a = state.answers[uid]?.[it.id];
    if(a) done++;
    got += it.w * val(a);
    tot += it.w;
  });
  const prof = state.profiles[uid] || {};
  const pDone = PROFILE_Q.filter(q => prof[q.id] !== undefined).length;
  const iss = state.issues[uid] || {};
  return {
    pct: tot ? got/tot*100 : 0, done, total: items.length,
    pDone, pTotal: PROFILE_Q.length,
    issueCount: Object.keys(iss).filter(k => iss[k]).length,
    complete: done === items.length && pDone === PROFILE_Q.length
  };
}

function envRisk(uid){
  const env = envOf(uid); if(!env) return null;
  const t = allTypes().find(x => x.id === env.typeId) || {baseRisk:0.6, cat:'C1', name:env.name};
  const prof = state.profiles[uid] || {};
  const items = itemsFor(env.typeId);

  // 잠재위험: 유형 구조위험 45% + 프로파일 55%
  let ps = 0, pw = 0;
  PROFILE_Q.forEach(q => {
    const idx = prof[q.id];
    if(idx === undefined || !q.opts[idx]){ pw += q.w; return; }
    const o = q.opts[idx];
    ps += o.v * q.w; pw += q.w;
  });
  const profileRisk = pw ? ps / pw : 0.5;
  const inherentRaw = t.baseRisk * 0.45 + profileRisk * 0.55;
  const inherent = Math.round(inherentRaw * 100);

  // 통제율
  let got = 0, tot = 0, critGot = 0, critTot = 0;
  items.forEach(it => {
    const a = state.answers[uid]?.[it.id];
    const v = val(a);
    got += it.w * v; tot += it.w;
    if(it.w === 3){ critGot += it.w * v; critTot += it.w; }
  });
  const cover = tot ? got / tot : 0;
  const critCover = critTot ? critGot / critTot : 0;

  // 필수 미달 개수
  const critMissing = items.filter(it => it.w === 3 && val(state.answers[uid]?.[it.id]) < 1);

  // 잔여위험
  let residual = inherent * (1 - cover * 0.9) * (1 + (1 - critCover) * 0.5);
  residual = Math.max(residual, Math.min(inherent, critMissing.length * 6));
  residual = Math.max(0, Math.min(inherent, Math.round(residual)));

  // 이슈 가산 (심각도 3=5점, 2=3점, 1=1점, 최대 20)
  const iss = state.issues[uid] || {};
  const found = issuesFor(env.typeId).filter(i => iss[i.id]);
  const issueAdd = Math.min(20, found.reduce((a,i) => a + (i.sev===3?5:i.sev===2?3:1), 0));
  const total = Math.min(100, residual + issueAdd);

  return {inherent, cover, coverPct: Math.round(cover*100), critCover, critMissing,
          residual, issueAdd, total, found, baseRisk:t.baseRisk, cat:t.cat};
}

function riskColor(v){
  if(v >= 70) return '#dc2626';
  if(v >= 50) return '#c2410c';
  if(v >= 30) return '#0369a1';
  return '#047857';
}

function renderEnvTabs(){
  const host = $('envTabs');
  if(!state.envs.length){ host.innerHTML = ''; return; }
  host.innerHTML = state.envs.map((e, i) => {
    const st = envStats(e.uid);
    const t = allTypes().find(x => x.id === e.typeId) || {};
    const dot = !st.done && !st.pDone ? 'none' : st.complete ? 'ok' : (st.pct >= 55 ? 'mid' : 'low');
    return `<button class="etab ${i===state.idx?'on':''}" data-env-idx="${i}" type="button" title="${esc(t.name)}">
      <span class="dot ${dot}"></span>${i+1}. ${esc(t.name)}
      <span class="etab-cnt">${st.done}/${st.total}</span>
    </button>`;
  }).join('');
  host.querySelectorAll('[data-env-idx]').forEach(b => {
    b.addEventListener('click', () => {
      state.idx = Number(b.dataset.envIdx); save(); renderEnvTabs(); renderAssess();
      window.scrollTo({top:120, behavior:'smooth'});
    });
  });
}

function renderAssess(){
  const host = $('assessHost');
  if(!state.envs.length){
    host.innerHTML = `<div class="empty">선택한 환경이 없습니다. 1단계에서 환경을 먼저 선택하세요.</div>`;
    return;
  }
  const env = state.envs[state.idx];
  const t = allTypes().find(x => x.id === env.typeId) || {name:env.name, cat:'C1', desc:'', key:''};
  const st = envStats(env.uid);
  const prof = state.profiles[env.uid] || {};
  const items = itemsFor(env.typeId);
  const issues = issuesFor(env.typeId);
  const iSel = state.issues[env.uid] || {};

  host.innerHTML = `
  <div class="card">
    <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">
      <div style="flex:1;min-width:220px">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;flex-wrap:wrap">
          <span class="chip info">${esc((CAT_BY_ID[t.cat]||{}).name||'')}</span>
          ${t.flag?'<span class="chip bad">고위험 유형</span>':''}
          <span class="chip">${state.idx+1} / ${state.envs.length}</span>
        </div>
        <h2 style="margin:0 0 4px">${esc(t.name)}</h2>
        <p style="color:var(--muted);font-size:13px;margin:0">${esc(t.desc||'')}</p>
        ${t.key?`<p style="font-size:12.5px;color:#b45309;margin:6px 0 0">▲ ${esc(t.key)}</p>`:''}
        ${env.owner?`<p style="font-size:12.5px;color:var(--muted);margin:6px 0 0">담당: ${esc(env.owner)}${env.users?' · 사용자 '+esc(env.users)+'명':''}</p>`:''}
      </div>
      <div style="text-align:right">
        <div style="font-size:22px;font-weight:750;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:${riskColor(envRisk(env.uid).total)}">${envRisk(env.uid).total}</div>
        <small style="color:var(--muted)">현재 위험 점수</small>
      </div>
    </div>
    <div class="bar" style="margin-top:14px"><i style="width:${st.pct}%;background:${riskColor(100-st.pct)}"></i></div>
    <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11.5px;color:var(--muted)">
      <span>통제 달성 ${Math.round(st.pct)}%</span>
      <span>프로파일 ${st.pDone}/${st.pTotal} · 통제 ${st.done}/${st.total} · 이슈 ${st.issueCount}</span>
    </div>
  </div>

  <div class="card">
    <h2 class="cardt">A. 이 환경의 프로파일</h2>
    <p class="hint" style="margin-bottom:6px">4문항이 이 환경의 잠재위험을 결정합니다.</p>
    ${PROFILE_Q.map((q, qi) => `
      <div class="q" data-q="${q.id}">
        <div class="q-head"><span class="q-num">Q${qi+1}</span><div class="q-title">${esc(q.title)}</div></div>
        <p class="q-sub">${esc(q.sub)}${DESC[q.id] ? ' ' + esc(DESC[q.id].d) : ''}</p>
        <div class="opts">
          ${q.opts.map((o, oi) => `
            <label class="opt ${prof[q.id]===oi?'sel':''}">
              <input type="radio" name="p_${env.uid}_${q.id}" value="${oi}" ${prof[q.id]===oi?'checked':''}>
              <span>${esc(o.label)}<span class="tag">${esc(o.tag)}</span></span>
            </label>`).join('')}
        </div>
      </div>`).join('')}
  </div>

  <div class="card">
    <h2 class="cardt">B. 통제 점검 (${items.length}개)</h2>
    <p class="hint" style="margin-bottom:4px">${esc(t.name)}에 적용되는 항목입니다. ‘예’는 기준을 모두 갖춘 경우, ‘부분’은 일부만 갖춘 경우, ‘아니오’는 없는 경우, ‘모름’은 확인하지 못한 경우입니다.</p>
    ${items.map(it => itemHTML(it, state.answers[env.uid]?.[it.id], `a_${env.uid}_`)).join('')}
  </div>

  <div class="card">
    <h2 class="cardt">C. 정보보안 이슈 체크 (${issues.length}개)</h2>
    <p class="hint" style="margin-bottom:10px">지금 우리 회사에 해당하는 상황을 <b>모두</b> 선택하세요. 각 이슈의 ‘해당 기준’을 보고 판단합니다. 체크된 항목은 심각도에 따라 위험 점수에 가산됩니다.</p>
    <div id="issueHost">
      ${issues.map(is => `
        <label class="env ${iSel[is.id]?'sel':''}" data-issue="${is.id}" style="margin-bottom:7px;align-items:flex-start">
          <input type="checkbox" ${iSel[is.id]?'checked':''} aria-label="${esc(is.t)}">
          <span class="env-body">
            <span class="env-name" style="font-weight:600">${esc(is.t)}
              <span class="chip ${is.sev===3?'bad':is.sev===2?'warn':''}" style="font-size:10px">${is.sev===3?'치명':is.sev===2?'중대':'경미'}</span>
            </span>
            ${DESC[is.id] ? `<span class="env-desc"><b>해당 기준</b> ${esc(DESC[is.id].d)}</span>` : ''}
            <span class="env-desc"><b>위험</b> ${esc(is.why)}</span>
            <span class="env-eg">확인 방법: ${esc(is.check)}</span>
          </span>
        </label>`).join('')}
    </div>
  </div>`;

  // 프로파일 이벤트
  host.querySelectorAll('.q').forEach(qEl => {
    qEl.querySelectorAll('input[type=radio]').forEach(inp => {
      inp.addEventListener('change', () => {
        state.profiles[env.uid] = state.profiles[env.uid] || {};
        state.profiles[env.uid][qEl.dataset.q] = Number(inp.value);
        qEl.querySelectorAll('.opt').forEach(o => o.classList.toggle('sel', o.querySelector('input').checked));
        save(); paintProgress(); refreshAssessHeader();
      });
    });
  });

  // 통제 이벤트
  bindItems(host, (id, a) => {
    state.answers[env.uid] = state.answers[env.uid] || {};
    state.answers[env.uid][id] = a;
    save(); paintProgress(); renderEnvTabs(); refreshAssessHeader();
  });

  // 이슈 이벤트
  host.querySelectorAll('[data-issue]').forEach(lb => {
    const cb = lb.querySelector('input');
    cb.addEventListener('change', () => {
      state.issues[env.uid] = state.issues[env.uid] || {};
      state.issues[env.uid][lb.dataset.issue] = cb.checked;
      lb.classList.toggle('sel', cb.checked);
      save(); paintProgress(); refreshAssessHeader();
    });
  });

  $('btnPrevEnv').disabled = state.idx === 0;
  $('btnNextEnv').textContent = state.idx === state.envs.length - 1 && state.envs.length > 1 ? '진단 결과 보기 →' : '다음 환경 →';
  if(state.envs.length === 1) $('btnNextEnv').textContent = '진단 결과 보기 →';
  $('assessFoot').textContent = `${state.idx+1} / ${state.envs.length} 환경 · ${st.done}/${st.total} 항목`;
}

function refreshAssessHeader(){
  const env = state.envs[state.idx]; if(!env) return;
  const st = envStats(env.uid);
  const r = envRisk(env.uid);
  const card = $('assessHost').querySelector('.card');
  if(!card) return;
  const scoreEl = card.querySelector('div[style*="text-align:right"] > div');
  if(scoreEl){ scoreEl.textContent = r.total; scoreEl.style.color = riskColor(r.total); }
  const bar = card.querySelector('.bar i');
  if(bar){ bar.style.width = st.pct + '%'; bar.style.background = riskColor(100-st.pct); }
  const spans = card.querySelectorAll('div[style*="justify-content:space-between"] span');
  if(spans[0]) spans[0].textContent = '통제 달성 ' + Math.round(st.pct) + '%';
  if(spans[1]) spans[1].textContent = `프로파일 ${st.pDone}/${st.pTotal} · 통제 ${st.done}/${st.total} · 이슈 ${st.issueCount}`;
  $('assessFoot').textContent = `${state.idx+1} / ${state.envs.length} 환경 · ${st.done}/${st.total} 항목`;
}
