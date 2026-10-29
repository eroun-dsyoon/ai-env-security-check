
/* ============================================================
   9-1. 4단계 — 보안기술·제품군 보유 점검
   ============================================================ */
let techShowAll = false;
const TECH_BY_ID = Object.fromEntries(TECH.map(t => [t.id, t]));
const LAYER_BY_ID = Object.fromEntries(TECH_LAYERS.map(l => [l.id, l]));
const techVal = (k) => (TECH_STATUS.find(s => s.k === k)?.v ?? 0);
const techLabel = (k) => (TECH_STATUS.find(s => s.k === k)?.label ?? '미응답');

function techLevelFor(tech, t){
  if(!t.custom && tech.envNeed && t.id in tech.envNeed) return tech.envNeed[t.id];
  return tech.need[t.cat] || 0;
}

/* 선택한 환경 기준으로 기술마다 필요도(2=필수, 1=권장, 0=해당 없음)와 근거 환경을 계산 */
function techNeeds(){
  return TECH.map(tech => {
    const base = state.envs.length ? (tech.base || 0) : 0;
    let level = base;
    const drivers = [];
    state.envs.forEach(e => {
      const t = allTypes().find(x => x.id === e.typeId); if(!t) return;
      const l = techLevelFor(tech, t);
      if(l > 0) drivers.push({name: t.name, level: l});
      if(l > level) level = l;
    });
    return {tech, level, base, drivers};
  });
}

/* 이 기술이 뒷받침하는 통제 중 미흡한 것, 체크된 관련 이슈 */
function techEvidence(tech){
  const fails = [], issues = [];
  tech.ctrls.forEach(cid => {
    if(cid.startsWith('CM-')){
      const it = COMMON_ITEMS.find(x => x.id === cid);
      if(it && val(state.common[cid]) < 1) fails.push({id:cid, t:it.t, where:'전사 공통', a:state.common[cid]});
      return;
    }
    state.envs.forEach(e => {
      const it = itemsFor(e.typeId).find(x => x.id === cid); if(!it) return;
      const a = state.answers[e.uid]?.[cid];
      if(val(a) < 1) fails.push({id:cid, t:it.t, where:(typeOf(e.uid)||{}).name || e.name, a});
    });
  });
  state.envs.forEach(e => {
    const sel = state.issues[e.uid] || {};
    issuesFor(e.typeId).forEach(is => {
      if(tech.issues.includes(is.id) && sel[is.id]) issues.push({...is, where:(typeOf(e.uid)||{}).name || e.name});
    });
  });
  return {fails, issues};
}

function techReport(){
  const rows = techNeeds().filter(r => r.level > 0).map(r => {
    const st = state.tech[r.tech.id] || {};
    const ev = techEvidence(r.tech);
    const v = techVal(st.s);
    const score = r.level * 10 + ev.fails.length * 3 + ev.issues.reduce((a, i) => a + i.sev * 2, 0);
    return {...r, s: st.s, p: st.p || '', v, ...ev, score};
  });
  let got = 0, tot = 0;
  rows.forEach(r => { got += r.level * r.v; tot += r.level; });
  const missing = rows.filter(r => r.v < 1)
    .sort((a, b) => (b.level - a.level) || (a.v - b.v) || (b.score - a.score));
  return {
    rows, missing,
    pct: tot ? Math.round(got / tot * 100) : 0,
    answered: rows.filter(r => r.s).length,
    must: rows.filter(r => r.level === 2),
    mustMissing: missing.filter(r => r.level === 2 && r.v === 0)
  };
}

function needChip(level){
  return level === 2 ? '<span class="crit">필수</span>' : level === 1 ? '<span class="rec">권장</span>' : '<span class="na">해당 환경 없음</span>';
}

function driverText(r){
  const names = [...new Set(r.drivers.filter(d => d.level === r.level).map(d => d.name))];
  const parts = [];
  if(r.base && r.base >= r.level) parts.push('AI를 쓰는 모든 조직');
  if(names.length) parts.push(names.slice(0, 4).join(', ') + (names.length > 4 ? ` 외 ${names.length - 4}개` : ''));
  if(!parts.length && r.drivers.length) parts.push([...new Set(r.drivers.map(d => d.name))].slice(0, 4).join(', '));
  return parts.join(' · ') || '선택한 환경과 직접 관련 없음';
}

function techHTML(r){
  const st = state.tech[r.tech.id] || {};
  const cls = (k) => st.s === k ? 'sel-' + ({yes:'y',part:'p',no:'n',unknown:'x'}[k]) : '';
  return `
  <div class="item tech" data-tech="${r.tech.id}">
    <div class="item-head">
      <div class="item-title">${esc(r.tech.name)}${needChip(r.level)}</div>
      <div class="item-ref">${r.tech.id}</div>
    </div>
    <p class="tech-desc">${esc(r.tech.desc)}</p>
    <div class="evidence"><b>필요 근거</b><span>${esc(driverText(r))}</span></div>
    <div class="ans">
      ${TECH_STATUS.map(a => `<label class="${cls(a.k)}"><input type="radio" name="t_${r.tech.id}" value="${a.k}" ${st.s===a.k?'checked':''}>${a.label}</label>`).join('')}
    </div>
    <input class="tech-prod" type="text" value="${esc(st.p || '')}" placeholder="사용 중인 제품·서비스명 (선택)" aria-label="${esc(r.tech.name)} 사용 제품명">
    <div class="item-guide ${st.s==='no'||st.s==='unknown'?'show':''}"><b>왜 필요한가 —</b> ${esc(r.tech.why)}<br><b>도입 첫 단계 —</b> ${esc(r.tech.how)}</div>
  </div>`;
}

function renderTech(){
  const host = $('techHost');
  const needs = techNeeds();
  const shown = needs.filter(r => techShowAll || r.level > 0);
  const rep = techReport();
  host.innerHTML = `
  <div class="card card-tight" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
    <div style="font-size:13px;color:var(--ink2)">필요 기술 <b id="techCnt" style="font-size:16px;color:#0f172a">${rep.answered}/${rep.rows.length}</b> 응답 · 필수 ${rep.must.length}개</div>
    <div style="flex:1;min-width:140px"><div class="bar"><i id="techBar" style="width:${rep.pct}%;background:${riskColor(100 - rep.pct)}"></i></div></div>
    <span class="chip info" id="techPct">확보율 ${rep.pct}%</span>
    <label style="font-size:12.5px;color:var(--ink2);display:flex;gap:6px;align-items:center;cursor:pointer">
      <input type="checkbox" id="techAll" ${techShowAll?'checked':''}> 필요하지 않은 기술도 보기
    </label>
  </div>
  ${TECH_LAYERS.map(l => {
    const list = shown.filter(r => r.tech.layer === l.id);
    if(!list.length) return '';
    return `<div class="card">
      <h2 class="cardt">${esc(l.name)} <small style="color:var(--muted);font-weight:500">${list.length}개</small></h2>
      ${list.map(techHTML).join('')}
    </div>`;
  }).join('')}`;

  const refresh = () => {
    const r2 = techReport();
    $('techCnt').textContent = `${r2.answered}/${r2.rows.length}`;
    $('techBar').style.width = r2.pct + '%';
    $('techBar').style.background = riskColor(100 - r2.pct);
    $('techPct').textContent = `확보율 ${r2.pct}%`;
    $('techFoot').textContent = `${r2.answered} / ${r2.rows.length} 기술 응답`;
    paintProgress();
  };

  host.querySelectorAll('.tech').forEach(row => {
    const id = row.dataset.tech;
    row.querySelectorAll('input[type=radio]').forEach(inp => {
      inp.addEventListener('change', () => {
        state.tech[id] = Object.assign({}, state.tech[id], {s: inp.value});
        row.querySelectorAll('.ans label').forEach(lb => {
          const r = lb.querySelector('input');
          lb.className = r.checked ? 'sel-' + ({yes:'y',part:'p',no:'n',unknown:'x'}[r.value]) : '';
        });
        row.querySelector('.item-guide').classList.toggle('show', inp.value === 'no' || inp.value === 'unknown');
        save(); refresh();
      });
    });
    row.querySelector('.tech-prod').addEventListener('input', (ev) => {
      state.tech[id] = Object.assign({}, state.tech[id], {p: ev.target.value});
      save();
    });
  });
  $('techAll').addEventListener('change', (ev) => { techShowAll = ev.target.checked; renderTech(); });
  $('techFoot').textContent = `${rep.answered} / ${rep.rows.length} 기술 응답`;
}

/* ============================================================
   9-2. 결과 화면 — 보안기술 보유 현황과 추천
   ============================================================ */
function renderTechResult(T){
  const host = $('techResult');
  if(!T.rows.length){ host.innerHTML = '<div class="empty">환경을 선택하면 필요한 보안기술이 표시됩니다.</div>'; return; }

  const byLayer = TECH_LAYERS.map(l => {
    const rs = T.rows.filter(r => r.tech.layer === l.id);
    return {l, n: rs.length, yes: rs.filter(r => r.s === 'yes').length, part: rs.filter(r => r.s === 'part').length,
            miss: rs.filter(r => r.v === 0).length, must: rs.filter(r => r.level === 2 && r.v === 0).length};
  }).filter(x => x.n);

  const owned = T.rows.filter(r => r.s === 'yes' || r.s === 'part');
  const recs = T.missing.slice(0, 12);

  host.innerHTML = `
  <div class="card">
    <h2 class="cardt">보안기술·제품군 보유 현황</h2>
    <p class="hint" style="margin-bottom:12px">선택한 AI 환경에 필요한 기술 ${T.rows.length}개(필수 ${T.must.length}개) 중 보유 현황입니다. 확보율은 필수 2배·권장 1배 가중, 일부 적용은 절반으로 계산합니다.</p>
    <div class="tbl-wrap"><table>
      <thead><tr><th>계층</th><th style="width:70px">필요</th><th style="width:70px">사용 중</th><th style="width:80px">일부 적용</th><th style="width:96px">미보유·모름</th><th style="width:96px">필수 미보유</th></tr></thead>
      <tbody>${byLayer.map(x => `<tr>
        <td><b>${esc(x.l.name)}</b></td><td class="num">${x.n}</td><td class="num">${x.yes}</td><td class="num">${x.part}</td>
        <td class="num">${x.miss}</td><td class="num">${x.must ? `<b style="color:#dc2626">${x.must}</b>` : '0'}</td></tr>`).join('')}</tbody>
    </table></div>
    ${owned.length ? `<p class="hint" style="margin-top:12px"><b>보유 기술</b> — ${owned.map(r => esc(r.tech.name.replace(/ \(.*\)$/, '')) + (r.p ? ` (${esc(r.p)})` : '') + (r.s === 'part' ? ' [일부]' : '')).join(' · ')}</p>` : ''}
  </div>

  <div class="section-head"><h2>추천 — 부족한 보안기술·제품군</h2>
    <p class="hint">${T.missing.length ? `미보유·일부 적용 ${T.missing.length}개 중 우선순위 상위 ${recs.length}개입니다. 필수 여부, 미흡한 관련 통제 수, 체크된 이슈의 심각도로 정렬했습니다.` : '필요한 기술을 모두 보유하고 있습니다.'}</p></div>
  ${recs.length ? recs.map((r, i) => {
    const sev = r.level === 2 && r.v === 0 ? 'p1' : r.level === 2 ? 'p2' : 'p3';
    const failIds = [...new Set(r.fails.map(f => f.id))];
    return `
    <div class="gap ${sev}">
      <div class="gap-top">
        <div class="gap-title">${i + 1}. ${esc(r.tech.name)}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <span class="chip ${r.level===2?'bad':'warn'}">${r.level===2?'필수':'권장'}</span>
          <span class="chip">${r.s ? techLabel(r.s) : '미응답'}</span>
          <span class="chip info">${esc(LAYER_BY_ID[r.tech.layer].name)}</span>
        </div>
      </div>
      <div class="gap-body">
        <div>${esc(r.tech.desc)}</div>
        <div class="how"><b>왜 필요한가 —</b> ${esc(r.tech.why)}<br><b>도입 첫 단계 —</b> ${esc(r.tech.how)}</div>
      </div>
      <div class="gap-meta">
        <div><em>필요 환경</em><span>${esc(driverText(r))}</span></div>
        <div><em>미흡한 관련 통제</em><span>${failIds.length ? esc(failIds.join(', ')) + ` (${r.fails.length}건)` : '없음'}</span></div>
        <div><em>관련 이슈</em><span>${r.issues.length ? esc([...new Set(r.issues.map(x => x.t))].slice(0, 2).join(' / ')) + (r.issues.length > 2 ? ` 외 ${r.issues.length - 2}건` : '') : '체크된 이슈 없음'}</span></div>
        <div><em>현재 제품</em><span>${r.p ? esc(r.p) : '–'}</span></div>
      </div>
    </div>`;
  }).join('') : `<div class="card"><div class="alert ok"><span>✓</span><div><b>필요한 보안기술을 모두 보유하고 있습니다.</b> — 각 기술의 정책이 AI 서비스까지 실제로 적용되는지 분기마다 확인하세요.</div></div></div>`}`;
}
