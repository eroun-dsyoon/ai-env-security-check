/* ============================================================
   7. 1단계 — 인벤토리
   ============================================================ */
const COMMON_SET = ['E101','E102','E201','E203','E205','E302','E401','E402','E503','E601','E701','E702','E703'];

function renderCatalog(){
  const host = $('catalogHost');
  host.innerHTML = CATEGORIES.map(cat => {
    const types = allTypes().filter(t => t.cat === cat.id);
    if(!types.length) return '';
    return `
    <div class="cat-block">
      <div class="cat-head">
        <span class="code">${cat.id}</span>
        <h3>${esc(cat.name)}</h3>
        <span>${esc(cat.desc)}</span>
      </div>
      <div class="env-grid">
        ${types.map(t => {
          const sel = state.envs.some(e => e.typeId === t.id);
          return `
          <label class="env ${sel ? 'sel' : ''}" data-type="${t.id}">
            <input type="checkbox" value="${t.id}" ${sel ? 'checked' : ''}>
            <span class="env-body">
              <span class="env-name">${esc(t.name)}${t.flag ? '<span class="env-flag">고위험</span>' : ''}${t.custom ? '<span class="env-flag" style="background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe">직접추가</span>' : ''}</span>
              <span class="env-desc">${esc(t.desc)}</span>
              <span class="env-eg">${esc(t.eg || '')}</span>
            </span>
          </label>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  host.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      const tid = cb.value;
      cb.closest('.env').classList.toggle('sel', cb.checked);
      if(cb.checked){
        if(!state.envs.some(e => e.typeId === tid)){
          const t = allTypes().find(x => x.id === tid);
          state.envs.push({uid: uidFor(tid), typeId: tid, name: t.name, owner:'', users:'', note:''});
        }
      } else {
        state.envs = state.envs.filter(e => e.typeId !== tid);
        if(state.idx >= state.envs.length) state.idx = Math.max(0, state.envs.length - 1);
      }
      paintInv();
      save();
    });
  });

}

function renderCustom(){
  const host = $('customHost');
  if(!customFormOpen && !state.custom.length){ host.innerHTML = ''; return; }
  host.innerHTML = (customFormOpen ? renderCustomForm() : '') + (state.custom.length ? `
  <div class="card">
    <h2 class="cardt">직접 추가한 환경</h2>
    <p class="hint" style="margin-bottom:10px">목록에 없는 사내 시스템·도구입니다. 가장 유사한 범주를 고르면 그 범주의 통제·이슈 항목이 적용됩니다.</p>
    <div class="tbl-wrap"><table>
      <thead><tr><th>환경명</th><th style="width:130px">범주</th><th style="width:70px">관리</th></tr></thead>
      <tbody>
      ${state.custom.map(c => `<tr>
        <td><b>${esc(c.name)}</b><div style="color:var(--muted);font-size:12px">${esc(c.desc||'')}</div></td>
        <td>${esc((CAT_BY_ID[c.cat]||{}).name || c.cat)}</td>
        <td><button class="btn-ghost btn-sm" data-del-custom="${c.id}" type="button">삭제</button></td>
      </tr>`).join('')}
      </tbody>
    </table></div>
  </div>` : '');

  bindCustomForm();
  host.querySelectorAll('[data-del-custom]').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.dataset.delCustom;
      const used = state.envs.filter(e => e.typeId === id);
      if(used.length && !confirm('이 환경을 사용 중인 점검이 있습니다. 삭제하면 해당 응답도 사라집니다. 계속할까요?')) return;
      const uids = used.map(e => e.uid);
      uids.forEach(u => { delete state.profiles[u]; delete state.answers[u]; delete state.issues[u]; });
      state.envs = state.envs.filter(e => e.typeId !== id);
      state.custom = state.custom.filter(c => c.id !== id);
      renderCatalog(); renderCustom(); paintInv(); save();
    });
  });
}

function renderInvMeta(){
  const card = $('invMetaCard');
  const host = $('invMetaHost');
  if(!state.envs.length){ card.hidden = true; return; }
  card.hidden = false;
  host.innerHTML = state.envs.map(e => {
    const t = allTypes().find(x => x.id === e.typeId) || {};
    return `
    <div class="meta-row">
      <div style="font-size:13px"><b>${esc(t.name||e.name)}</b><div style="color:var(--muted);font-size:11.5px">${esc((CAT_BY_ID[t.cat]||{}).name||'')}</div></div>
      <input type="text" data-owner="${e.uid}" value="${esc(e.owner||'')}" placeholder="담당 관리자 (부서·이름)"
        aria-label="${esc(t.name)} 담당 관리자"
        style="padding:7px 10px;border:1px solid var(--line2);border-radius:8px;font:inherit;font-size:13px;width:100%">
      <input type="text" data-users="${e.uid}" value="${esc(e.users||'')}" placeholder="사용자 수"
        aria-label="${esc(t.name)} 사용자 수"
        style="padding:7px 10px;border:1px solid var(--line2);border-radius:8px;font:inherit;font-size:13px;width:100%">
    </div>`;
  }).join('');

  host.querySelectorAll('[data-owner]').forEach(inp => {
    inp.addEventListener('input', () => {
      const e = envOf(inp.dataset.owner); if(e){ e.owner = inp.value; save(); }
    });
  });
  host.querySelectorAll('[data-users]').forEach(inp => {
    inp.addEventListener('input', () => {
      const e = envOf(inp.dataset.users); if(e){ e.users = inp.value; save(); }
    });
  });
}

function paintInv(){
  const n = state.envs.length;
  $('invCount').textContent = n;
  const byCat = {};
  state.envs.forEach(e => {
    const t = allTypes().find(x => x.id === e.typeId);
    if(t) byCat[t.cat] = (byCat[t.cat]||0)+1;
  });
  const parts = CATEGORIES.filter(c => byCat[c.id]).map(c => `${c.name} ${byCat[c.id]}`);
  $('invByCat').textContent = parts.length ? ' · ' + parts.join(' · ') : '';
  $('invFoot').textContent = n ? `${n}개 환경 선택됨` : '아직 선택한 환경이 없습니다';
  $('btnToCommon').disabled = n === 0;
  renderInvMeta();
}
