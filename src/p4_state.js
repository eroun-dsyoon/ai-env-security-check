/* ============================================================
   6. 상태·유틸
   ============================================================ */
const KEY = 'ai_env_selfcheck_v1';
const EMPTY_STATE = () => ({envs:[], custom:[], common:{}, profiles:{}, answers:{}, issues:{}, tech:{}, idx:0, view:'intro'});
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const ENV_BY_ID = Object.fromEntries(ENV_TYPES.map(e => [e.id, e]));
const CAT_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

/* 환경 목록: 선택된 환경 인스턴스 배열 {uid, typeId, name, owner, users, note}
   common: 전사 공통 응답, profiles: uid -> {q1..q4},
   answers: uid -> {itemId: 'yes'|'part'|'no'|'unknown'}, issues: uid -> {issueId: true},
   tech: techId -> {s: 'yes'|'part'|'no'|'unknown', p: 사용 제품명} */
let state = EMPTY_STATE();

/* 저장·불러온 상태를 현재 스키마로 맞춘다 */
function normalizeState(s, view){
  const st = Object.assign(EMPTY_STATE(), s, view ? {view} : {});
  st.envs.forEach(e => { if(TYPE_MIGRATE[e.typeId]) e.typeId = TYPE_MIGRATE[e.typeId]; });
  if(!st.tech || typeof st.tech !== 'object') st.tech = {};
  if(st.idx >= st.envs.length) st.idx = 0;
  return st;
}

function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){}
}
function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return false;
    const s = JSON.parse(raw);
    if(!s || !Array.isArray(s.envs)) return false;
    state = normalizeState(s);
    return true;
  }catch(e){ return false; }
}
function toast(msg){
  const t = $('toast'); if(!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 2800);
}
const val = (k) => (ANSWERS.find(a => a.k === k)?.v ?? 0);

function allTypes(){
  return ENV_TYPES.concat(state.custom.map(c => ({...c, custom:true})));
}
function typeOf(uid){
  const env = envOf(uid);
  if(!env) return null;
  return allTypes().find(t => t.id === env.typeId) || ENV_BY_ID[env.typeId] || null;
}
function envOf(uid){ return state.envs.find(e => e.uid === uid) || null; }
/* env 목록이 있는 항목은 그 환경 유형에만 적용한다. 직접 추가한 환경은 범주 전체를 적용한다. */
function appliesTo(it, t){ return !it.env || t.custom || it.env.includes(t.id); }
function itemsFor(typeId){
  const t = allTypes().find(x => x.id === typeId);
  if(!t) return [];
  return (CTRL_GROUPS[t.cat] || []).filter(it => appliesTo(it, t));
}
function issuesFor(typeId){
  const t = allTypes().find(x => x.id === typeId);
  if(!t) return [];
  return (ISSUES[t.cat] || []).filter(it => appliesTo(it, t));
}
function uidFor(typeId){
  return 'u' + typeId + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
}
