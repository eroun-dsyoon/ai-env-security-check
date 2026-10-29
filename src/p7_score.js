/* ============================================================
   10. 조직 종합 점수
   ============================================================ */
function exposureWeight(uid){
  const env = envOf(uid); if(!env) return 1;
  const prof = state.profiles[uid] || {};
  // 사용자 범위(q3) × 데이터 등급(q1) → 노출 가중치 (1~9)
  const u = prof.q3 !== undefined ? PROFILE_Q[2].opts[prof.q3].v : 0.5;
  const d = prof.q1 !== undefined ? PROFILE_Q[0].opts[prof.q1].v : 0.5;
  return 0.6 + u * 4.4 + d * 4;
}

function commonStats(){
  let got = 0, tot = 0, answered = 0;
  const critMissing = [];
  COMMON_ITEMS.forEach(it => {
    const a = state.common[it.id];
    if(a) answered++;
    got += it.w * val(a); tot += it.w;
    if(it.w === 3 && val(a) < 1) critMissing.push(it);
  });
  return {cover: tot ? got/tot : 0, pct: Math.round((tot?got/tot:0)*100), answered, total: COMMON_ITEMS.length, critMissing};
}

function orgScore(){
  const cs = commonStats();
  const rows = state.envs.map(env => {
    const r = envRisk(env.uid);
    const st = envStats(env.uid);
    const t = allTypes().find(x => x.id === env.typeId) || {};
    return {env, t, ...r, st, weight: exposureWeight(env.uid)};
  });

  let wsum = 0, rsum = 0;
  rows.forEach(x => { wsum += x.weight; rsum += x.total * x.weight; });
  const weighted = wsum ? rsum / wsum : 0;

  // 전사 공통 통제 미비 → 최대 15점 가산
  const commonPenalty = Math.round((1 - cs.cover) * 15);
  // 필수 공통 항목 미비 하한
  const floor = Math.min(100, cs.critMissing.length * 5);

  let total = Math.round(weighted + commonPenalty);
  total = Math.max(total, floor);
  total = Math.max(0, Math.min(100, total));

  // 환경 미선택 시
  if(!rows.length) total = 0;

  const grade = gradeOf(total, cs.critMissing.length, rows);
  const issues = [];
  state.envs.forEach(env => {
    const iss = state.issues[env.uid] || {};
    issuesFor(env.typeId).forEach(is => {
      if(iss[is.id]) issues.push({...is, env, type: allTypes().find(x => x.id === env.typeId)});
    });
  });
  issues.sort((a,b) => b.sev - a.sev);

  return {rows, cs, weighted, commonPenalty, total, grade, issues,
          top: [...rows].sort((a,b)=>b.total-a.total)};
}

function gradeOf(total, critCommon, rows){
  const worst = rows.length ? Math.max(...rows.map(r => r.total)) : 0;
  if(!rows.length)
    return {g:'미진단', color:'#64748b', dark:'#334155',
      title:'아직 점검한 환경이 없습니다',
      desc:'1단계에서 사용 중인 AI 환경을 선택하면 조직 종합 위험이 계산됩니다. 환경 목록이 비어 있으면 어떤 통제도 적용할 수 없습니다.'};
  if(total >= 70 || worst >= 85)
    return {g:'심각', color:'#dc2626', dark:'#991b1b',
      title:'조직 전체 AI 위험이 통제 불가 수준입니다',
      desc:'고위험 환경이 다수이고 필수 통제가 비어 있습니다. 한 번의 사고로 대규모 유출이 발생할 수 있으며, 사고 시 통지·입증도 어렵습니다. 고위험 환경부터 즉시 차단·격리하세요.'};
  if(total >= 50 || worst >= 70 || critCommon >= 2)
    return {g:'높음', color:'#c2410c', dark:'#9a3412',
      title:'통제 격차가 크고 위험이 실질적입니다',
      desc:'가장 위험한 환경이 조직 전체 점수를 끌어내리고 있습니다. 90일 내 고위험 환경의 잔여위험을 40점 이하로 낮추는 것을 목표로 하세요.'};
  if(total >= 30 || worst >= 50 || critCommon >= 1)
    return {g:'보통', color:'#0369a1', dark:'#075985',
      title:'관리 가능한 수준이나 보완이 필요합니다',
      desc:'주요 통제는 작동하고 있으나, 일부 환경이나 공통 항목에 빈틈이 있습니다. 분기 내 마무리하고 증적으로 남기세요.'};
  return {g:'낮음', color:'#047857', dark:'#065f46',
    title:'양호한 통제 수준입니다',
    desc:'위험을 구조적으로 낮춘 상태입니다. 지금의 통제를 유지·검증하는 체계(리허설, 로그 리뷰, 제공자 정책 재확인)에 집중하세요.'};
}

/* ============================================================
   11. 결과 렌더
   ============================================================ */
function renderResult(){
  const R = orgScore();
  const T = techReport();
  const A = buildActions(R, T);
  const d = new Date();
  const doneEnvs = R.rows.filter(x => x.st.complete).length;
  $('resultStamp').textContent =
    `진단일 ${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} · `
    + `환경 ${state.envs.length}개 (완료 ${doneEnvs}) · 공통 ${R.cs.answered}/${R.cs.total} · 수집된 이슈 ${R.issues.length}건`;

  // 히어로
  const C = 2 * Math.PI * 86;
  $('resultHero').innerHTML = `
  <div class="score-hero">
    <div>
      <div class="gauge">
        <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="86" fill="none" stroke="#eef2f7" stroke-width="16"></circle>
          <circle id="gaugeArc" cx="100" cy="100" r="86" fill="none" stroke="${R.grade.color}" stroke-width="16"
                  stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}"></circle>
        </svg>
        <div class="val"><b style="color:${R.grade.color}">${R.total}</b><span>조직 종합 위험</span></div>
      </div>
    </div>
    <div>
      <div class="grade" style="background:${R.grade.color}12;color:${R.grade.dark};border:1px solid ${R.grade.color}55">위험 등급 · ${R.grade.g}</div>
      <h2 style="margin-bottom:6px">${esc(R.grade.title)}</h2>
      <p style="font-size:14px;color:var(--ink2)">${esc(R.grade.desc)}</p>
      <div class="kpis">
        <div class="kpi"><span>점검 환경</span><b>${state.envs.length}</b><small>완료 ${doneEnvs}개</small></div>
        <div class="kpi"><span>최고 위험 환경</span><b style="color:${R.top[0]?riskColor(R.top[0].total):'#0f172a'}">${R.top[0]?R.top[0].total:'–'}</b><small>${R.top[0]?esc(R.top[0].t.name):'환경 없음'}</small></div>
        <div class="kpi"><span>공통 통제</span><b>${R.cs.pct}%</b><small>${R.cs.answered}/${R.cs.total} 응답</small></div>
        <div class="kpi"><span>정보보안 이슈</span><b>${R.issues.length}</b><small>치명 ${R.issues.filter(i=>i.sev===3).length}건</small></div>
        <div class="kpi"><span>보안기술 확보율</span><b>${T.pct}%</b><small>필수 미보유 ${T.mustMissing.length}개</small></div>
      </div>
    </div>
  </div>
  <div id="verdictAlert"></div>`;

  requestAnimationFrame(() => {
    const arc = $('gaugeArc');
    if(arc){ arc.style.transition = 'stroke-dashoffset .9s ease'; arc.setAttribute('stroke-dashoffset', (C * (1 - R.total/100)).toFixed(2)); }
  });

  // 경고
  const alerts = [];
  if(!state.envs.length) alerts.push(['bad','환경이 선택되지 않았습니다','1단계로 돌아가 사용 중인 AI 환경을 선택하세요.']);
  if(R.cs.answered < R.cs.total) alerts.push(['warn','공통 통제 미응답 '+(R.cs.total-R.cs.answered)+'개','미응답은 미구현으로 계산됩니다.']);
  if(R.cs.critMissing.length) alerts.push(['bad','공통 필수 통제 '+R.cs.critMissing.length+'개 미비',R.cs.critMissing.map(x=>x.id).join(', ')+' — 모든 환경에 영향을 줍니다.']);
  const incomplete = R.rows.filter(x => !x.st.complete);
  if(incomplete.length) alerts.push(['warn','점검 미완료 환경 '+incomplete.length+'개',incomplete.slice(0,4).map(x=>x.t.name).join(', ')+(incomplete.length>4?' 외':''), ]);
  const critIssues = R.issues.filter(i=>i.sev===3);
  if(critIssues.length) alerts.push(['bad','치명 이슈 '+critIssues.length+'건 발견','아래 이슈 목록에서 즉시 조치 대상을 확인하세요.']);
  if(!alerts.length) alerts.push(['ok','모든 환경 점검 완료','필수 통제 미비가 없습니다. 유지·검증 체계로 전환하세요.']);
  $('verdictAlert').innerHTML = alerts.map(([k,t,b]) =>
    `<div class="alert ${k}"><span>${k==='bad'?'▲':k==='ok'?'✓':'!'}</span><div><b>${esc(t)}</b>${b?' — '+esc(b):''}</div></div>`).join('');

  renderSummary(R, T, A);
  renderTechResult(T);

  // 매트릭스
  const sorted = [...R.rows].sort((a,b) => b.weight - a.weight || b.total - a.total);
  $('matrixTable').innerHTML = `
    <thead><tr>
      <th>환경</th><th style="width:110px">범주</th><th style="width:70px">노출</th>
      <th style="width:80px">잠재위험</th><th style="width:80px">통제율</th>
      <th style="width:80px">이슈</th><th style="width:90px">위험점수</th><th style="width:60px">상태</th>
    </tr></thead>
    <tbody>
    ${sorted.map((x, i) => `
      <tr>
        <td><b>${esc(x.t.name)}</b>${x.t.flag?' <span class="chip bad" style="font-size:10px">고위험</span>':''}
          ${x.env.owner?`<div style="font-size:11.5px;color:var(--muted)">${esc(x.env.owner)}</div>`:''}</td>
        <td style="font-size:12px;color:var(--muted)">${esc((CAT_BY_ID[x.t.cat]||{}).name||'')}</td>
        <td class="num">${x.weight.toFixed(1)}</td>
        <td class="num">${x.inherent}</td>
        <td class="num">${x.coverPct}%</td>
        <td class="num">${x.found.length}</td>
        <td class="num"><b style="color:${riskColor(x.total)}">${x.total}</b></td>
        <td>${x.st.complete?'<span class="chip ok">완료</span>':'<span class="chip warn">진행</span>'}</td>
      </tr>`).join('')}
    </tbody>`;

  // 범주별
  const byCat = {};
  R.rows.forEach(x => {
    const c = x.t.cat;
    byCat[c] = byCat[c] || {tot:0, num:0};
    byCat[c].tot += x.total; byCat[c].num++;
  });
  $('catBars').innerHTML = CATEGORIES.filter(c => byCat[c.id]).map(c => {
    const v = byCat[c.id].tot / byCat[c.id].num;
    return `<div style="display:grid;grid-template-columns:170px 1fr 96px;gap:10px;align-items:center;font-size:12.5px">
      <div>${esc(c.name)} <small style="color:#64748b">·${byCat[c.id].num}개</small></div>
      <div class="bar"><i style="width:${v}%;background:${riskColor(v)}"></i></div>
      <div style="text-align:right;font-weight:650;font-variant-numeric:tabular-nums;color:${riskColor(v)}">${Math.round(v)}점</div>
    </div>`;
  }).join('') || '<div class="empty">환경을 선택하면 범주별 분포가 표시됩니다.</div>';

  // 이슈
  $('issueSummary').textContent = R.issues.length
    ? `총 ${R.issues.length}건 — 치명 ${R.issues.filter(i=>i.sev===3).length} · 중대 ${R.issues.filter(i=>i.sev===2).length} · 경미 ${R.issues.filter(i=>i.sev===1).length}`
    : (state.envs.some(e => Object.values(state.issues[e.uid]||{}).some(Boolean))
        ? '이슈가 체크되지 않았습니다. 3단계 C항목에서 해당되는 것을 확인하세요.'
        : '아직 이슈를 점검하지 않았습니다. 3단계 C항목에서 해당되는 것을 모두 선택하세요.');
  $('issueList').innerHTML = R.issues.length ? R.issues.map(is => `
    <div class="gap ${is.sev===3?'p1':is.sev===2?'p2':'p3'}">
      <div class="gap-top">
        <div class="gap-title">${esc(is.t)}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <span class="chip ${is.sev===3?'bad':is.sev===2?'warn':''}">${is.sev===3?'치명':is.sev===2?'중대':'경미'}</span>
          <span class="chip">${esc(is.type.name)}</span>
        </div>
      </div>
      <div class="gap-body">
        ${DESC[is.id] ? `<div><b>해당 기준</b> — ${esc(DESC[is.id].d)}</div>` : ''}
        <div><b>위험</b> — ${esc(is.why)}</div>
        <div class="how"><b>확인·조치 —</b> ${esc(is.check)}</div>
      </div>
      <div class="gap-meta">
        <div><em>환경</em><span>${esc(is.type.name)}</span></div>
        <div><em>범주</em><span>${esc((CAT_BY_ID[is.type.cat]||{}).name||'')}</span></div>
        <div><em>이슈 ID</em><span>${is.id}</span></div>
        <div><em>가산점</em><span>+${is.sev===3?5:is.sev===2?3:1}점</span></div>
      </div>
    </div>`).join('') : '<div class="empty">발견된 이슈가 없습니다.</div>';

  renderGaps(R);
  renderRoadmap(A);

  $('standardList').innerHTML = STANDARDS.map(s => `<div>· ${esc(s)}</div>`).join('');
}

/* 미달 항목 수집 — 결과의 “부족한 부분”과 로드맵이 같은 우선순위를 쓴다
   0: 공통 필수 미구현, 1: 환경 필수 미구현 → P0 (0–30일)
   2: 필수 부분 구현, 3: 중요 미구현      → P1 (30–60일)
   4: 나머지(중요 부분 구현, 보완 항목)   → P2 (60–90일) */
const GAP_PHASE = [0, 0, 1, 1, 2];
const GAP_LABEL = ['P0 · 즉시 (0–30일)','P0 · 즉시 (0–30일)','P1 · 단기 (30–60일)','P1 · 단기 (30–60일)','P2 · 보완 (60–90일)'];
const GAP_CLS = ['p1','p1','p2','p2','p3'];

function gapPrio(x){
  if(x.w === 3 && x.v === 0) return x.kind === 'common' ? 0 : 1;
  if(x.w === 3) return 2;
  if(x.w === 2 && x.v === 0) return 3;
  return 4;
}

function collectGaps(){
  const list = [];
  COMMON_ITEMS.forEach(it => {
    const a = state.common[it.id];
    if(val(a) >= 1) return;
    list.push({kind:'common', id:it.id, t:it.t, w:it.w, fix:it.fix, ev:it.ev,
      envName:'전사 공통', cat:'공통', a: a || 'none', v: val(a)});
  });
  state.envs.forEach(env => {
    const t = allTypes().find(x => x.id === env.typeId) || {};
    itemsFor(env.typeId).forEach(it => {
      const a = state.answers[env.uid]?.[it.id];
      if(val(a) >= 1) return;
      list.push({kind:'env', id:it.id, t:it.t, w:it.w, fix:it.fix, ev:it.ev,
        envName:t.name, cat:(CAT_BY_ID[t.cat]||{}).name||'', a: a||'none', v: val(a), uid:env.uid});
    });
  });
  list.forEach(x => { x.p = gapPrio(x); });
  list.sort((a,b) => a.p - b.p || b.w - a.w);
  return list;
}

function renderGaps(R){
  const list = collectGaps();

  $('gapSummary').textContent = list.length
    ? `총 ${list.length}개 항목이 미달입니다. 우선순위 순으로 상위 ${Math.min(list.length,20)}개를 표시합니다.`
    : '미달 항목이 없습니다.';

  if(!list.length){
    $('gapList').innerHTML = `<div class="card"><div class="alert ok"><span>✓</span><div><b>모든 점검 항목이 충족되었습니다.</b> — 이제 통제가 실제로 작동하는지 검증하는 단계로 넘어가세요. 연 1회 리허설, 분기별 제공자 정책 재확인, 월별 로그 리뷰를 일정에 고정하세요.</div></div></div>`;
    return;
  }

  $('gapList').innerHTML = list.slice(0, 20).map((x, i) => `
    <div class="gap ${GAP_CLS[x.p]}">
      <div class="gap-top">
        <div class="gap-title">${i+1}. ${esc(x.t)}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <span class="chip ${x.p<=1?'bad':x.p<=3?'warn':'info'}">${GAP_LABEL[x.p]}</span>
          <span class="chip">${esc(x.envName)}</span>
        </div>
      </div>
      <div class="gap-body">
        ${DESC[x.id] ? `<div><b>점검 내용</b> — ${esc(DESC[x.id].d)}</div>` : ''}
        <div class="how"><b>이렇게 채우세요 —</b> ${esc(x.fix)}${DESC[x.id]?.ok ? `<br><b>완료 기준 —</b> ${esc(DESC[x.id].ok)}` : ''}</div>
      </div>
      <div class="gap-meta">
        <div><em>확인 증적</em><span>${esc(x.ev)}</span></div>
        <div><em>현재 상태</em><span>${x.a==='none'?'미응답':x.a==='unknown'?'모름':x.a==='part'?'부분 구현':'미구현'}</span></div>
        <div><em>범주</em><span>${esc(x.cat)}</span></div>
        <div><em>항목 ID</em><span>${x.id} (가중치 ${x.w})</span></div>
      </div>
    </div>`).join('');
}

/* 로드맵 3단계: 통제 미달 + 이슈(심각도) + 보안기술(필요도) */
function buildActions(R, T){
  const ph = [[], [], []];
  collectGaps().forEach(x => ph[GAP_PHASE[x.p]].push(`[${x.envName}] ${x.t}`));
  R.issues.forEach(i => ph[3 - i.sev].push(`[${i.type.name}] 이슈 해소 — ${i.t}`));
  T.missing.forEach(r => {
    const name = r.tech.name.replace(/ \(.*\)$/, '');
    if(r.level === 2) ph[r.v === 0 ? 1 : 2].push(`[보안기술] ${r.v === 0 ? '도입' : '적용 확대'} — ${name}`);
    else ph[2].push(`[보안기술] 도입 검토 — ${name}`);
  });
  return {p0: dedupe(ph[0]), p1: dedupe(ph[1]), p2: dedupe(ph[2])};
}

function renderRoadmap(A){
  const block = (title, when, arr, fb) => `
    <div class="rm">
      <div class="when">${when}</div>
      <h3>${title}</h3>
      <ol>${(arr.length ? arr.slice(0,8) : [fb]).map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      ${arr.length > 8 ? `<p class="note">외 ${arr.length-8}건</p>` : ''}
    </div>`;

  $('roadmap').innerHTML =
    block('즉시 차단·격리', '0–30일 · P0', A.p0, '즉시 조치 항목 없음 — 현 통제 유지') +
    block('구조적 통제·기술 정비', '30–60일 · P1', A.p1, 'P1 항목 없음 — 다음 단계로') +
    block('보완·검증·정착', '60–90일 · P2', A.p2, '남은 보완 항목 없음 — 리허설로 전환');
}

/* 경영진용 한 장 요약 */
function renderSummary(R, T, A){
  const top3 = R.top.slice(0, 3);
  const crit = R.issues.filter(i => i.sev === 3);
  const mm = T.mustMissing.slice(0, 3).map(r => r.tech.name.replace(/ \(.*\)$/, ''));
  $('resultSummary').innerHTML = `
    <h2 class="cardt">종합 리포트 요약</h2>
    <ol class="sum-list">
      <li><b>조직 종합 위험 ${R.total}점 · ${esc(R.grade.g)}</b> — 환경 ${state.envs.length}개, 전사 공통 통제 달성률 ${R.cs.pct}%, 필수 공통 통제 미비 ${R.cs.critMissing.length}개.</li>
      <li><b>가장 위험한 환경</b> — ${top3.length ? top3.map(x => `${esc(x.t.name)} ${x.total}점`).join(', ') : '없음'}.</li>
      <li><b>정보보안 이슈</b> — 총 ${R.issues.length}건, 이 가운데 치명 ${crit.length}건${crit.length ? ` (${esc(crit.slice(0,2).map(i => i.t).join(' / '))}${crit.length > 2 ? ' 외' : ''})` : ''}.</li>
      <li><b>보안기술 확보율 ${T.pct}%</b> — 필요 기술 ${T.rows.length}개 중 필수 미보유 ${T.mustMissing.length}개${mm.length ? `: ${esc(mm.join(', '))}${T.mustMissing.length > 3 ? ' 외' : ''}` : ''}.</li>
      <li><b>조치 계획</b> — 즉시(0–30일) ${A.p0.length}건, 단기(30–60일) ${A.p1.length}건, 보완(60–90일) ${A.p2.length}건.</li>
    </ol>`;
}

function dedupe(arr){ return [...new Set(arr.filter(Boolean))]; }
