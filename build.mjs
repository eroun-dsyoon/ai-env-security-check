#!/usr/bin/env node
// 기업 AI 사용환경 보안 체크 도구 — 빌드 스크립트
// src/의 조각 파일을 순서대로 이어붙여 단일 자립형 index.html을 만듭니다.
// 사용: node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const parts = [
  'p1_head.html',
  'p2_body.html',
  'p3_data.js',
  'p3b_tech.js',
  'p3c_desc.js',
  'p4_state.js',
  'p5_inventory.js',
  'p6_assess.js',
  'p65_tech.js',
  'p7_score.js',
  'p75_help.js',
  'p8_boot.js',
  'p9_wire.js',
];
const out = join(here, 'index.html');

const html = parts.map(p => readFileSync(join(here, 'src', p), 'utf8')).join('')
  + '\n</script>\n</body>\n</html>\n';
writeFileSync(out, html, 'utf8');

const checks = {
  bytes: Buffer.byteLength(html, 'utf8'),
  scripts: (html.match(/<script>/g) || []).length,
  closes: (html.match(/<\/script>/g) || []).length,
  sections: (html.match(/<section id="view-/g) || []).length,
  externalRefs: (html.match(/(src|href)=["']https?:/g) || []).length,
};
console.log(out);
console.log(checks);
if (checks.scripts !== checks.closes) { console.error('script 태그 불일치'); process.exit(1); }
if (checks.externalRefs !== 0) { console.error('외부 참조가 있습니다'); process.exit(1); }
if (checks.sections !== 6) { console.error('섹션 수가 6(intro+5)이 아닙니다'); process.exit(1); }
