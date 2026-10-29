/* ============================================================
   14. 이벤트 배선
   ============================================================ */
function sampleState(){
  const picks = ['E102','E201','E503','E401','E601','E702'];
  const envs = picks.map(tid => {
    const t = ENV_BY_ID[tid];
    return {uid:'u' + tid + '_s', typeId: tid, name: t.name, owner:'', users:'', note:''};
  });
  envs[0].owner = '개발플랫폼팀'; envs[0].users = '48';
  envs[1].owner = '경영지원팀'; envs[1].users = '120';
  envs[2].owner = '고객서비스팀'; envs[2].users = '35';
  envs[3].owner = '정보시스템팀'; envs[3].users = '310';
  envs[4].owner = '정보시스템팀'; envs[4].users = '12';
  envs[5].owner = '미확인'; envs[5].users = '?';

  const common = {};
  COMMON_ITEMS.forEach((it, i) => {
    common[it.id] = i < 4 ? 'yes' : i < 9 ? 'part' : i < 11 ? 'yes' : i === 11 ? 'part' : i === 12 ? 'no' : 'no';
  });

  const profiles = {}, answers = {}, issues = {};
  const pv = [2,2,2,1];
  envs.forEach((e, i) => {
    const p = {};
    if(i === 0) { p.q1=1; p.q2=3; p.q3=2; p.q4=1; }
    else if(i === 1) { p.q1=3; p.q2=0; p.q3=2; p.q4=2; }
    else if(i === 2) { p.q1=3; p.q2=2; p.q3=1; p.q4=2; }
    else if(i === 3) { p.q1=2; p.q2=1; p.q3=3; p.q4=2; }
    else if(i === 4) { p.q1=1; p.q2=1; p.q3=0; p.q4=1; }
    else { p.q1=3; p.q2=1; p.q3=2; p.q4=3; }
    profiles[e.uid] = p;

    const a = {};
    const items = itemsFor(e.typeId);
    items.forEach((it, j) => {
      if(i === 5) a[it.id] = 'unknown';
      else if(i === 4) a[it.id] = j % 5 === 0 ? 'part' : 'yes';
      else if(it.w === 3) a[it.id] = j % 3 === 0 ? 'no' : j % 3 === 1 ? 'yes' : 'part';
      else a[it.id] = j % 4 === 0 ? 'part' : 'yes';
    });
    answers[e.uid] = a;

    const is = {};
    if(i === 0) { is['I1-1'] = true; is['I1-4'] = true; }
    if(i === 1) { is['I2-2'] = true; }
    if(i === 2) { is['I5-7'] = true; is['I5-1'] = true; }
    if(i === 3) { is['I4-1'] = true; }
    if(i === 5) { is['I7-1'] = true; is['I7-2'] = true; }
    issues[e.uid] = is;
  });

  const tech = {
    T01:{s:'no'}, T02:{s:'part', p:'사내 프록시'}, T04:{s:'no'}, T06:{s:'part'}, T07:{s:'no'},
    T08:{s:'yes', p:'Microsoft Entra ID'}, T09:{s:'part'}, T10:{s:'yes'}, T11:{s:'no'}, T12:{s:'part', p:'gitleaks(CI)'},
    T13:{s:'yes'}, T14:{s:'yes'}, T15:{s:'no'}, T17:{s:'no'}, T18:{s:'unknown'}, T19:{s:'no'},
    T20:{s:'no'}, T22:{s:'no'}, T23:{s:'yes'}, T24:{s:'no'}, T25:{s:'yes'}, T26:{s:'part'}
  };

  return {envs, custom:[], common, profiles, answers, issues, tech, idx:0, view:'result'};
}

function wire(){
  // 시작
  $('btnStart').addEventListener('click', () => show('inventory'));

  $('btnLoadSample').addEventListener('click', () => {
    if(state.envs.length && !confirm('현재 입력한 내용을 지우고 예시 데이터로 바꿉니다. 계속할까요?')) return;
    state = sampleState();
    save(); show('result');
    toast('예시 조직 결과를 불러왔습니다');
  });

  // 범례 링크
  document.querySelectorAll('[data-goto]').forEach(a => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const v = a.dataset.goto;
      if((v === 'assess' || v === 'tech' || v === 'result') && !state.envs.length){ toast('먼저 1단계에서 환경을 선택하세요'); return; }
      show(v);
    });
  });

  // 1단계
  $('btnSelectCommon').addEventListener('click', () => {
    COMMON_SET.forEach(tid => {
      if(!ENV_BY_ID[tid]) return;
      if(state.envs.some(e => e.typeId === tid)) return;
      const t = ENV_BY_ID[tid];
      state.envs.push({uid: uidFor(tid), typeId: tid, name:t.name, owner:'', users:'', note:''});
    });
    renderCatalog(); paintInv(); save();
    toast('일반적인 기업 구성 ' + state.envs.length + '개 환경을 선택했습니다');
  });

  $('btnAddCustom').addEventListener('click', () => {
    customFormOpen = true;
    renderCustom();
    const el = $('cfName'); if(el){ el.focus(); el.scrollIntoView({block:'center', behavior:'smooth'}); }
  });

  $('btnToCommon').addEventListener('click', () => {
    if(!state.envs.length){ toast('환경을 하나 이상 선택하세요'); return; }
    show('common');
  });

  // 2단계
  $('btnToAssess').addEventListener('click', () => {
    const n = COMMON_ITEMS.filter(it => !state.common[it.id]).length;
    if(n && !confirm('공통 통제 ' + n + '개 항목이 미응답입니다. 미응답은 미구현으로 계산됩니다. 계속할까요?')) return;
    show('assess');
  });

  // 3단계
  $('btnPrevEnv').addEventListener('click', () => {
    if(state.idx > 0){ state.idx--; save(); renderEnvTabs(); renderAssess(); window.scrollTo({top:120,behavior:'smooth'}); }
  });
  $('btnNextEnv').addEventListener('click', () => {
    if(state.idx < state.envs.length - 1){
      state.idx++; save(); renderEnvTabs(); renderAssess(); window.scrollTo({top:120,behavior:'smooth'});
    } else {
      const incomplete = state.envs.filter(e => !envStats(e.uid).complete);
      if(incomplete.length && !confirm('점검이 끝나지 않은 환경이 ' + incomplete.length + '개 있습니다. 보안기술 점검으로 넘어갈까요?')) return;
      show('tech');
    }
  });

  // 4단계
  $('btnToResult').addEventListener('click', () => {
    const n = techNeeds().filter(r => r.level > 0 && !state.tech[r.tech.id]?.s).length;
    if(n && !confirm('보안기술 ' + n + '개가 미응답입니다. 미응답은 미보유로 계산됩니다. 계속할까요?')) return;
    show('result');
  });

  // 결과 화면 버튼
  $('btnReport').addEventListener('click', exportReport);
  $('btnGlossary').addEventListener('click', () => openGlossary(''));
  $('btnPrint').addEventListener('click', () => window.print());

  $('btnExport').addEventListener('click', () => {
    const d = new Date();
    const stamp = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
    const payload = {app:'AI_환경_전수조사_자기진단', version:1, savedAt:d.toISOString(), state};
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'AI환경_자기진단_' + stamp + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('진단 결과를 파일로 저장했습니다');
  });

  $('btnImport').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if(!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try{
        const j = JSON.parse(String(rd.result));
        const s = j && j.state ? j.state : j;
        if(!s || !Array.isArray(s.envs)) throw new Error('형식이 아닙니다');
        state = normalizeState(s, 'result');
        save(); show(state.envs.length ? 'result' : 'inventory');
        toast('불러왔습니다 — 환경 ' + state.envs.length + '개');
      }catch(e){
        toast('파일을 읽을 수 없습니다. 이 도구에서 저장한 JSON인지 확인하세요');
      }
      ev.target.value = '';
    };
    rd.readAsText(f);
  });

  $('btnRestart').addEventListener('click', () => {
    if(!confirm('모든 응답을 지우고 처음부터 시작합니다. 저장된 내용도 삭제됩니다. 계속할까요?')) return;
    resetAll();
  });

  $('btnBackAssess').addEventListener('click', () => show('assess'));
  $('btnBackTech').addEventListener('click', () => show('tech'));
  $('btnBackInventory').addEventListener('click', () => show('inventory'));

  $('btnReset').addEventListener('click', () => {
    if(!confirm('진행 중인 응답을 모두 지웁니다. 계속할까요?')) return;
    resetAll();
  });

  // 키보드
  document.addEventListener('keydown', (ev) => {
    const t = ev.target;
    if(t && t.matches && t.matches('input, select, textarea')) return;
    if(t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if(ev.key === 'ArrowRight' && state.view === 'assess' && state.idx < state.envs.length - 1){
      state.idx++; save(); renderEnvTabs(); renderAssess();
    }
    if(ev.key === 'ArrowLeft' && state.view === 'assess' && state.idx > 0){
      state.idx--; save(); renderEnvTabs(); renderAssess();
    }
  });
}

/* 결과 화면을 독립 HTML 리포트로 저장 (용어 풀이 부록 포함) */
function exportReport(){
  const d = new Date();
  const stamp = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
  const src = $('view-result');
  const used = [...new Set([...src.querySelectorAll('.help')].map(b => b.dataset.help))]
    .map(id => GLOSS_BY_ID[id]).filter(Boolean).sort((a, b) => a.term.localeCompare(b.term, 'ko'));
  const view = src.cloneNode(true);
  view.removeAttribute('hidden');
  view.querySelectorAll('.no-print, .help, input').forEach(n => n.remove());
  const css = document.querySelector('style').textContent;
  const gloss = used.length ? `<div class="card"><h2 class="cardt">부록 — 용어 풀이</h2><div class="tbl-wrap"><table>
    <thead><tr><th style="width:200px">용어</th><th>설명</th></tr></thead>
    <tbody>${used.map(g => `<tr><td><b>${esc(g.term)}</b></td><td>${esc(g.d)}</td></tr>`).join('')}</tbody></table></div></div>` : '';
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI 사용환경 보안 진단 리포트 ${stamp}</title><style>${css}</style></head>
<body><main style="padding-top:24px">${view.outerHTML}${gloss}</main></body></html>`;
  const blob = new Blob([html], {type:'text/html'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'AI환경_보안진단_리포트_' + stamp + '.html';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast('종합 리포트를 HTML 파일로 저장했습니다');
}

function resetAll(){
  try{ localStorage.removeItem(KEY); }catch(e){}
  state = EMPTY_STATE();
  customFormOpen = false;
  save(); show('intro');
  toast('초기화했습니다');
}

/* ============================================================
   15. 부트
   ============================================================ */
(function boot(){
  wire();
  const had = load();
  let v = 'intro';
  if(had && state.envs.length){
    v = state.view === 'intro' ? 'inventory' : state.view;
  }
  show(v);
  startHelp();
})();
