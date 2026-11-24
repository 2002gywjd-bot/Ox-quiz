/* ══════════════════════════════════════════════════════════
   우리반 실시간 OX 퀴즈  ·  app.js
   선생님 브라우저가 방장(호스트)이 되고, 학생은 PeerJS(WebRTC)로
   직접 연결됩니다. 서버·회원가입 없이 동작해요.
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─────────── 도우미 ─────────── */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const now = () => Date.now();
  const perf = () => (window.performance && performance.now ? performance.now() : Date.now());

/* ══════════════════════════════════════════════════════════
   사람 캐릭터 — 표정 · 머리카락 · 체형 · 스타일 (항목별 5종)
   성별을 고정하지 않는 중성적인 톤으로 그린다.
   같은 조합이면 언제나 같은 SVG가 나오므로, 선생님 화면·학생 화면·
   순위표에서 똑같은 얼굴이 그려진다.
   ══════════════════════════════════════════════════════════ */
const AV_PART = {
  expr: ['smile', 'wink', 'focus', 'wow', 'tongue'],
  hair: ['short', 'wolf', 'bob', 'bun', 'wave'],
  body: ['petite', 'slim', 'normal', 'sturdy', 'round'],
  style: ['hoodie', 'shirtvest', 'overalls', 'sporty', 'knit']
};

const AV_TABS = [
  { key: 'expr', name: '표정', icon: '😊' },
  { key: 'hair', name: '머리', icon: '💇' },
  { key: 'body', name: '체형', icon: '🧍' },
  { key: 'style', name: '스타일', icon: '👕' }
];

const AV_LABEL = {
  smile: '미소', wink: '윙크', focus: '진지', wow: '놀람', tongue: '메롱',
  short: '숏컷', wolf: '울프컷', bob: '단발', bun: '묶은머리', wave: '웨이브',
  petite: '아담', slim: '슬림', normal: '보통', sturdy: '듬직', round: '통통',
  hoodie: '후드', shirtvest: '셔츠베스트', overalls: '멜빵', sporty: '스포티', knit: '니트'
};

const AV_DEFAULT = { expr: 'smile', hair: 'short', body: 'normal', style: 'hoodie' };

/* 체형별 머리·어깨 비율 (무대에서도 차이가 보이도록 폭을 크게 벌린다) */
const AV_BODY = {
  petite: { r: 22.5, hy: 45, nw: 7.5, sw: 15, sy: 79, shape: 'normal' },
  slim: { r: 17.5, hy: 41, nw: 6.5, sw: 12.5, sy: 73, shape: 'normal' },
  normal: { r: 19.5, hy: 43, nw: 10, sw: 21, sy: 75, shape: 'normal' },
  sturdy: { r: 17, hy: 39, nw: 13.5, sw: 30, sy: 69, shape: 'wide' },
  round: { r: 21.5, hy: 46, nw: 11.5, sw: 27, sy: 78, shape: 'belly' }
};

/* 머리카락 색 — 자연스러운 블랙·다크브라운·애쉬 계열 */
const AV_HAIR_COLOR = {
  short: '#2f2b33',
  wolf: '#4a3b2f',
  bob: '#3a332c',
  bun: '#332f39',
  wave: '#57483a'
};

const AV_STYLE = {
  hoodie: { main: '#5ec8f0', dark: '#2395c4', light: '#cdeefb', accent: '#ffffff' },
  shirtvest: { main: '#6a7ba0', dark: '#3b4763', light: '#fbfcff', accent: '#d7e0f2' },
  overalls: { main: '#8ab6ef', dark: '#3f6fc0', light: '#e3f0ff', accent: '#ffd45c' },
  sporty: { main: '#4ecb8d', dark: '#2a9d68', light: '#e2fbee', accent: '#ffffff' },
  knit: { main: '#c9b6f5', dark: '#7c5fd3', light: '#f4eeff', accent: '#ffd98a' }
};

const AV_SKIN = '#ffd9c0';
const AV_SKIN2 = '#f0b995';
const AV_INK = '#3b2c3a';

let AV_UID = 0;

function avn(v) { return Math.round(v * 10) / 10; }

function avPick(list, v, fallback) {
  return list.indexOf(v) >= 0 ? v : fallback;
}

/* 색을 어둡게(k<1) 만든다 — 머리 결·옷 주름에 쓴다 */
function avShade(hex, k) {
  const n = parseInt(String(hex).slice(1), 16);
  const f = function (v) { return Math.max(0, Math.min(255, Math.round(v * k))); };
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/* 어떤 값이 와도 {expr,hair,body,style} 로 안전하게 바꾼다.
   예전 버전의 이모지 문자열은 {emoji:'🐰'} 로 남겨 그대로 그린다. */
function normalizeAvatar(v) {
  if (v && typeof v === 'object') {
    return {
      expr: avPick(AV_PART.expr, v.expr, AV_DEFAULT.expr),
      hair: avPick(AV_PART.hair, v.hair, AV_DEFAULT.hair),
      body: avPick(AV_PART.body, v.body, AV_DEFAULT.body),
      style: avPick(AV_PART.style, v.style, AV_DEFAULT.style)
    };
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (s && s.length <= 8) return { emoji: s };
  }
  return { expr: AV_DEFAULT.expr, hair: AV_DEFAULT.hair, body: AV_DEFAULT.body, style: AV_DEFAULT.style };
}

function avatarKey(v) {
  const a = normalizeAvatar(v);
  return a.emoji ? 'e:' + a.emoji : a.expr + '|' + a.hair + '|' + a.body + '|' + a.style;
}

function randomAvatar() {
  const pick = function (list) { return list[Math.floor(Math.random() * list.length)]; };
  return {
    expr: pick(AV_PART.expr),
    hair: pick(AV_PART.hair),
    body: pick(AV_PART.body),
    style: pick(AV_PART.style)
  };
}

function avEsc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* 화면에 넣을 실제 마크업 (이모지 예전 아바타도 안전) */
function avatarMarkup(v, opt) {
  const a = normalizeAvatar(v);
  if (a.emoji) return '<span class="av-emoji">' + avEsc(a.emoji) + '</span>';
  return avSVG(a, opt);
}

/* ─────────── 몸통 ─────────── */
function avTorsoShape(b) {
  const cx = 50, sw = b.sw, nw = b.nw, sy = b.sy;
  const L = cx - sw, R = cx + sw;
  const nL = cx - nw - 2, nR = cx + nw + 2;

  if (b.shape === 'wide') {
    return 'M' + avn(L) + ' 104 L' + avn(L) + ' ' + avn(sy + 2) +
      ' L' + avn(L + sw * 0.42) + ' ' + avn(sy - 2) +
      ' Q' + avn(nL - 1) + ' ' + avn(sy - 3.5) + ' ' + avn(nL) + ' ' + avn(sy - 7) +
      ' Q50 ' + avn(sy - 10) + ' ' + avn(nR) + ' ' + avn(sy - 7) +
      ' Q' + avn(nR + 1) + ' ' + avn(sy - 3.5) + ' ' + avn(R - sw * 0.42) + ' ' + avn(sy - 2) +
      ' L' + avn(R) + ' ' + avn(sy + 2) + ' L' + avn(R) + ' 104 Z';
  }
  if (b.shape === 'belly') {
    return 'M' + avn(L - 2) + ' 104 C' + avn(L - 3) + ' ' + avn(sy + 12) + ' ' + avn(L) + ' ' + avn(sy + 3) + ' ' + avn(L + 6) + ' ' + avn(sy - 3) +
      ' Q' + avn(nL - 1) + ' ' + avn(sy - 6) + ' ' + avn(nL) + ' ' + avn(sy - 8) +
      ' Q50 ' + avn(sy - 11) + ' ' + avn(nR) + ' ' + avn(sy - 8) +
      ' Q' + avn(nR + 1) + ' ' + avn(sy - 6) + ' ' + avn(R - 6) + ' ' + avn(sy - 3) +
      ' C' + avn(R) + ' ' + avn(sy + 3) + ' ' + avn(R + 3) + ' ' + avn(sy + 12) + ' ' + avn(R + 2) + ' 104 Z';
  }
  return 'M' + avn(L) + ' 104 L' + avn(L) + ' ' + avn(sy + 5) +
    ' Q' + avn(L) + ' ' + avn(sy) + ' ' + avn(L + 9) + ' ' + avn(sy - 3) +
    ' L' + avn(nL) + ' ' + avn(sy - 6) +
    ' Q50 ' + avn(sy - 9) + ' ' + avn(nR) + ' ' + avn(sy - 6) +
    ' L' + avn(R - 9) + ' ' + avn(sy - 3) +
    ' Q' + avn(R) + ' ' + avn(sy) + ' ' + avn(R) + ' ' + avn(sy + 5) +
    ' L' + avn(R) + ' 104 Z';
}

function avTorso(a, b, st) {
  const cx = 50, sy = b.sy, nw = b.nw;
  const d = avTorsoShape(b);
  const ink = avShade(st.dark, 0.72);
  let s = '<path d="' + d + '" fill="' + st.main + '"/>';

  if (a.style === 'hoodie') {
    // 후드 목둘레 + 주머니 + 끈
    s += '<path d="M' + avn(cx - nw - 7) + ' ' + avn(sy - 6) +
      ' Q' + cx + ' ' + avn(sy + 13) + ' ' + avn(cx + nw + 7) + ' ' + avn(sy - 6) +
      ' Q' + cx + ' ' + avn(sy - 13) + ' ' + avn(cx - nw - 7) + ' ' + avn(sy - 6) + ' Z" fill="' + st.dark + '"/>';
    s += '<rect x="' + avn(cx - 13) + '" y="' + avn(sy + 15) + '" width="26" height="9" rx="4" fill="' + st.dark + '" opacity=".55"/>';
    s += '<path d="M' + avn(cx - 4) + ' ' + avn(sy + 3) + ' L' + avn(cx - 4.5) + ' ' + avn(sy + 13) + '" stroke="' + st.light + '" stroke-width="1.8" stroke-linecap="round"/>';
    s += '<path d="M' + avn(cx + 4) + ' ' + avn(sy + 3) + ' L' + avn(cx + 4.5) + ' ' + avn(sy + 12) + '" stroke="' + st.light + '" stroke-width="1.8" stroke-linecap="round"/>';
    s += '<circle cx="' + avn(cx - 4.6) + '" cy="' + avn(sy + 14) + '" r="1.5" fill="' + st.light + '"/>';
    s += '<circle cx="' + avn(cx + 4.6) + '" cy="' + avn(sy + 13) + '" r="1.5" fill="' + st.light + '"/>';
  } else if (a.style === 'shirtvest') {
    // 셔츠 + 조끼: 흰 셔츠의 V와 깃, 넥타이 없이 단추
    const vy = avn(sy + 24);
    s += '<path d="M' + avn(cx - nw - 6) + ' ' + avn(sy - 8) + ' L' + cx + ' ' + vy +
      ' L' + avn(cx + nw + 6) + ' ' + avn(sy - 8) +
      ' Q' + cx + ' ' + avn(sy - 13) + ' ' + avn(cx - nw - 6) + ' ' + avn(sy - 8) + ' Z" fill="' + st.light + '"/>';
    // 조끼 앞 여밈선
    s += '<path d="M' + avn(cx - nw - 6.5) + ' ' + avn(sy - 8) + ' L' + cx + ' ' + avn(sy + 26) +
      ' L' + avn(cx + nw + 6.5) + ' ' + avn(sy - 8) + '" stroke="' + ink + '" stroke-width="3.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>';
    // 셔츠 깃 (양쪽)
    s += '<path d="M' + avn(cx - nw - 5) + ' ' + avn(sy - 9) + ' L' + avn(cx - 1.5) + ' ' + avn(sy + 3) +
      ' L' + avn(cx - nw - 1) + ' ' + avn(sy + 5) + ' Z" fill="' + st.light + '" stroke="' + ink + '" stroke-width="1.1" stroke-linejoin="round"/>';
    s += '<path d="M' + avn(cx + nw + 5) + ' ' + avn(sy - 9) + ' L' + avn(cx + 1.5) + ' ' + avn(sy + 3) +
      ' L' + avn(cx + nw + 1) + ' ' + avn(sy + 5) + ' Z" fill="' + st.light + '" stroke="' + ink + '" stroke-width="1.1" stroke-linejoin="round"/>';
    // 단추
    s += '<circle cx="' + cx + '" cy="' + avn(sy + 9) + '" r="1.5" fill="' + st.accent + '"/>';
    s += '<circle cx="' + cx + '" cy="' + avn(sy + 17) + '" r="1.5" fill="' + st.accent + '"/>';
    // 조끼 밑단
    s += '<path d="M' + avn(cx - b.sw * 0.5) + ' 100 L' + avn(cx + b.sw * 0.5) + ' 100" stroke="' + ink + '" stroke-width="2" opacity=".35" stroke-linecap="round"/>';
  } else if (a.style === 'overalls') {
    // 멜빵 바지 + 단추
    s += '<path d="M' + avn(cx - 11) + ' ' + avn(sy + 4) + ' L' + avn(cx - 11) + ' 104 L' + avn(cx + 11) + ' 104 L' + avn(cx + 11) + ' ' + avn(sy + 4) + ' Z" fill="' + st.dark + '"/>';
    s += '<path d="M' + avn(cx - 11) + ' ' + avn(sy + 6) + ' L' + avn(cx - nw - 3) + ' ' + avn(sy - 5) + '" stroke="' + st.dark + '" stroke-width="4.6" stroke-linecap="round"/>';
    s += '<path d="M' + avn(cx + 11) + ' ' + avn(sy + 6) + ' L' + avn(cx + nw + 3) + ' ' + avn(sy - 5) + '" stroke="' + st.dark + '" stroke-width="4.6" stroke-linecap="round"/>';
    s += '<circle cx="' + avn(cx - 10) + '" cy="' + avn(sy + 8) + '" r="1.7" fill="' + st.accent + '"/>';
    s += '<circle cx="' + avn(cx + 10) + '" cy="' + avn(sy + 8) + '" r="1.7" fill="' + st.accent + '"/>';
    s += '<rect x="' + avn(cx - 6) + '" y="' + avn(sy + 15) + '" width="12" height="7" rx="2" fill="' + st.dark + '" opacity=".8"/>';
  } else if (a.style === 'sporty') {
    // 맨투맨/저지: 지퍼 + 깃 + 흰 줄
    s += '<rect x="' + avn(cx - 1) + '" y="' + avn(sy - 4) + '" width="2" height="26" fill="' + st.accent + '" opacity=".9"/>';
    s += '<path d="M' + avn(cx - nw - 4) + ' ' + avn(sy - 7) + ' Q' + cx + ' ' + avn(sy + 6) + ' ' + avn(cx + nw + 4) + ' ' + avn(sy - 7) + '" stroke="' + st.accent + '" stroke-width="3.2" fill="none" stroke-linecap="round"/>';
    s += '<path d="M' + avn(cx - b.sw * 0.72) + ' ' + avn(sy + 7) + ' L' + avn(cx - b.sw * 0.86) + ' ' + avn(sy + 30) + '" stroke="' + st.accent + '" stroke-width="2.6" opacity=".85"/>';
    s += '<path d="M' + avn(cx + b.sw * 0.72) + ' ' + avn(sy + 7) + ' L' + avn(cx + b.sw * 0.86) + ' ' + avn(sy + 30) + '" stroke="' + st.accent + '" stroke-width="2.6" opacity=".85"/>';
  } else {
    // 니트: 브이넥 + 뜨개 결
    s += '<path d="M' + avn(cx - nw - 4) + ' ' + avn(sy - 6) + ' L' + cx + ' ' + avn(sy + 13) + ' L' + avn(cx + nw + 4) + ' ' + avn(sy - 6) + '" fill="' + st.light + '"/>';
    s += '<path d="M' + avn(cx - nw - 4) + ' ' + avn(sy - 6) + ' L' + cx + ' ' + avn(sy + 13) + ' L' + avn(cx + nw + 4) + ' ' + avn(sy - 6) + '" stroke="' + st.dark + '" stroke-width="2.4" fill="none" stroke-linejoin="round"/>';
    s += '<path d="M' + avn(cx - 14) + ' ' + avn(sy + 18) + ' q7 4 14 0 q7 -4 14 0" stroke="' + st.dark + '" stroke-width="1.6" fill="none" opacity=".55"/>';
    s += '<path d="M' + avn(cx - 14) + ' ' + avn(sy + 25) + ' q7 4 14 0 q7 -4 14 0" stroke="' + st.dark + '" stroke-width="1.6" fill="none" opacity=".55"/>';
  }
  return s;
}

/* ─────────── 머리카락 ───────────
   다섯 가지 모두 성별을 고정하지 않는 실루엣.
   공통으로 정수리를 감싸는 '헤어 셸'을 얼굴 위에 얹고,
   스타일마다 앞머리 · 옆머리 · 뒤머리를 덧붙인다.
   side: 옆머리가 귀 아래로 내려오는 정도(r 배수)
   line: 이마 헤어라인 높이(r 배수, 클수록 이마가 넓다)
   w:    머리 폭 여유(px) */
function avHairShell(cx, hy, r, col, side, line, w) {
  const L = avn(cx - r - w), R = avn(cx + r + w);
  const sIn = avn(hy + r * side);
  const sTop = avn(hy + r * side * 0.5);
  return '<path d="M' + L + ' ' + sIn +
    ' C' + avn(cx - r - w * 1.25) + ' ' + avn(hy - r * 0.55) + ' ' + avn(cx - r * 0.95) + ' ' + avn(hy - r * 1.34) + ' ' + avn(cx) + ' ' + avn(hy - r * 1.36) +
    ' C' + avn(cx + r * 0.95) + ' ' + avn(hy - r * 1.34) + ' ' + avn(cx + r + w * 1.25) + ' ' + avn(hy - r * 0.55) + ' ' + R + ' ' + sIn +
    ' L' + avn(cx + r * 0.94) + ' ' + sTop +
    ' C' + avn(cx + r * 0.94) + ' ' + avn(hy + r * 0.02) + ' ' + avn(cx + r * 0.86) + ' ' + avn(hy - r * (line - 0.22)) + ' ' + avn(cx + r * 0.5) + ' ' + avn(hy - r * line) +
    ' C' + avn(cx + r * 0.22) + ' ' + avn(hy - r * (line + 0.15)) + ' ' + avn(cx - r * 0.22) + ' ' + avn(hy - r * (line + 0.15)) + ' ' + avn(cx - r * 0.5) + ' ' + avn(hy - r * line) +
    ' C' + avn(cx - r * 0.86) + ' ' + avn(hy - r * (line - 0.22)) + ' ' + avn(cx - r * 0.94) + ' ' + avn(hy + r * 0.02) + ' ' + avn(cx - r * 0.94) + ' ' + sTop +
    ' Z" fill="' + col + '"/>';
}

/* 뒤통수 쪽 머리 (얼굴 뒤에 깔린다) */
function avHairBack(a, cx, hy, r, col) {
  const sh = avShade(col, 0.78);

  if (a.hair === 'wolf') {
    // 목덜미에 닿는 레이어드 끝 — 뾰족한 결
    return '<path d="M' + avn(cx - r - 1) + ' ' + avn(hy - r * 0.38) +
      ' C' + avn(cx - r - 3.8) + ' ' + avn(hy + r * 0.4) + ' ' + avn(cx - r - 3.2) + ' ' + avn(hy + r * 0.78) + ' ' + avn(cx - r - 2.1) + ' ' + avn(hy + r * 0.92) +
      ' L' + avn(cx - r * 1.0) + ' ' + avn(hy + r * 1.14) +
      ' L' + avn(cx - r * 0.72) + ' ' + avn(hy + r * 0.9) +
      ' L' + avn(cx - r * 0.36) + ' ' + avn(hy + r * 1.16) +
      ' L' + avn(cx + r * 0.02) + ' ' + avn(hy + r * 0.92) +
      ' L' + avn(cx + r * 0.4) + ' ' + avn(hy + r * 1.16) +
      ' L' + avn(cx + r * 0.74) + ' ' + avn(hy + r * 0.9) +
      ' L' + avn(cx + r * 1.0) + ' ' + avn(hy + r * 1.14) +
      ' C' + avn(cx + r + 3.2) + ' ' + avn(hy + r * 0.78) + ' ' + avn(cx + r + 3.8) + ' ' + avn(hy + r * 0.4) + ' ' + avn(cx + r + 1) + ' ' + avn(hy - r * 0.38) + ' Z" fill="' + col + '"/>';
  }
  if (a.hair === 'bob') {
    // 단발의 뒤판 — 턱선 아래에서 살짝 말린 끝
    return '<path d="M' + avn(cx - r - 1) + ' ' + avn(hy - r * 0.3) +
      ' C' + avn(cx - r - 4.2) + ' ' + avn(hy + r * 0.5) + ' ' + avn(cx - r - 3.6) + ' ' + avn(hy + r * 0.92) + ' ' + avn(cx - r - 2.0) + ' ' + avn(hy + r * 1.0) +
      ' Q' + cx + ' ' + avn(hy + r * 1.22) + ' ' + avn(cx + r + 2.0) + ' ' + avn(hy + r * 1.0) +
      ' C' + avn(cx + r + 3.6) + ' ' + avn(hy + r * 0.92) + ' ' + avn(cx + r + 4.2) + ' ' + avn(hy + r * 0.5) + ' ' + avn(cx + r + 1) + ' ' + avn(hy - r * 0.3) + ' Z" fill="' + col + '"/>';
  }
  if (a.hair === 'bun') {
    // 낮게 묶은 번 — 뒤통수 아래로 살짝 보인다
    return '<circle cx="' + avn(cx - r * 0.86) + '" cy="' + avn(hy + r * 0.92) + '" r="' + avn(r * 0.44) + '" fill="' + col + '"/>' +
      '<path d="M' + avn(cx - r * 1.12) + ' ' + avn(hy + r * 0.86) +
      ' q' + avn(r * 0.3) + ' ' + avn(r * 0.26) + ' ' + avn(r * 0.52) + ' ' + avn(-r * 0.02) +
      '" stroke="' + sh + '" stroke-width="' + avn(r * 0.1) + '" fill="none" stroke-linecap="round" opacity=".8"/>';
  }
  if (a.hair === 'wave') {
    // 어깨까지 내려오는 물결 — 끝은 안쪽으로 말린다
    return '<path d="M' + avn(cx - r - 1) + ' ' + avn(hy - r * 0.35) +
      ' C' + avn(cx - r - 5.4) + ' ' + avn(hy + r * 0.45) + ' ' + avn(cx - r - 5.8) + ' ' + avn(hy + r * 0.95) + ' ' + avn(cx - r - 4.4) + ' ' + avn(hy + r * 1.22) +
      ' C' + avn(cx - r - 3.6) + ' ' + avn(hy + r * 1.4) + ' ' + avn(cx - r - 4.4) + ' ' + avn(hy + r * 1.5) + ' ' + avn(cx - r - 3.2) + ' ' + avn(hy + r * 1.54) +
      ' C' + avn(cx - r - 2.2) + ' ' + avn(hy + r * 1.58) + ' ' + avn(cx - r - 1.6) + ' ' + avn(hy + r * 1.4) + ' ' + avn(cx - r * 0.6) + ' ' + avn(hy + r * 1.42) +
      ' C' + avn(cx + r * 0.4) + ' ' + avn(hy + r * 1.46) + ' ' + avn(cx + r + 1.6) + ' ' + avn(hy + r * 1.56) + ' ' + avn(cx + r + 3.0) + ' ' + avn(hy + r * 1.5) +
      ' C' + avn(cx + r + 4.4) + ' ' + avn(hy + r * 1.42) + ' ' + avn(cx + r + 3.8) + ' ' + avn(hy + r * 1.3) + ' ' + avn(cx + r + 4.6) + ' ' + avn(hy + r * 1.18) +
      ' C' + avn(cx + r + 5.8) + ' ' + avn(hy + r * 0.95) + ' ' + avn(cx + r + 5.4) + ' ' + avn(hy + r * 0.45) + ' ' + avn(cx + r + 1) + ' ' + avn(hy - r * 0.35) + ' Z" fill="' + col + '"/>';
  }
  return '';
}

/* 얼굴 위에 얹는 앞머리 · 옆머리 */
function avHairFront(a, cx, hy, r, col) {
  const sh = avShade(col, 0.76);
  const hi = avShade(col, 1.5);
  let s = '';

  if (a.hair === 'short') {
    s += avHairShell(cx, hy, r, col, 0.34, 0.66, 1.5);
    // 옆으로 넘긴 앞머리
    s += '<path d="M' + avn(cx - r * 0.98) + ' ' + avn(hy - r * 0.12) +
      ' C' + avn(cx - r * 0.92) + ' ' + avn(hy - r * 0.62) + ' ' + avn(cx - r * 0.3) + ' ' + avn(hy - r * 0.9) + ' ' + avn(cx + r * 0.3) + ' ' + avn(hy - r * 0.92) +
      ' C' + avn(cx + r * 0.8) + ' ' + avn(hy - r * 0.9) + ' ' + avn(cx + r * 0.98) + ' ' + avn(hy - r * 0.55) + ' ' + avn(cx + r * 0.98) + ' ' + avn(hy - r * 0.14) +
      ' L' + avn(cx + r * 0.74) + ' ' + avn(hy - r * 0.42) +
      ' C' + avn(cx + r * 0.4) + ' ' + avn(hy - r * 0.58) + ' ' + avn(cx - r * 0.2) + ' ' + avn(hy - r * 0.56) + ' ' + avn(cx - r * 0.52) + ' ' + avn(hy - r * 0.34) +
      ' Z" fill="' + col + '"/>';
    // 귀 앞 짧은 옆머리
    s += '<path d="M' + avn(cx - r * 0.99) + ' ' + avn(hy - r * 0.2) + ' L' + avn(cx - r * 0.94) + ' ' + avn(hy + r * 0.22) +
      ' Q' + avn(cx - r * 0.86) + ' ' + avn(hy + r * 0.3) + ' ' + avn(cx - r * 0.82) + ' ' + avn(hy + r * 0.18) +
      ' L' + avn(cx - r * 0.88) + ' ' + avn(hy - r * 0.22) + ' Z" fill="' + col + '"/>';
    s += '<path d="M' + avn(cx + r * 0.99) + ' ' + avn(hy - r * 0.2) + ' L' + avn(cx + r * 0.94) + ' ' + avn(hy + r * 0.22) +
      ' Q' + avn(cx + r * 0.86) + ' ' + avn(hy + r * 0.3) + ' ' + avn(cx + r * 0.82) + ' ' + avn(hy + r * 0.18) +
      ' L' + avn(cx + r * 0.88) + ' ' + avn(hy - r * 0.22) + ' Z" fill="' + col + '"/>';
    // 결
    s += '<path d="M' + avn(cx - r * 0.34) + ' ' + avn(hy - r * 1.02) + ' C' + avn(cx - r * 0.1) + ' ' + avn(hy - r * 0.86) + ' ' + avn(cx + r * 0.3) + ' ' + avn(hy - r * 0.86) + ' ' + avn(cx + r * 0.6) + ' ' + avn(hy - r * 0.66) +
      '" stroke="' + hi + '" stroke-width="' + avn(r * 0.075) + '" fill="none" stroke-linecap="round" opacity=".28"/>';
  } else if (a.hair === 'wolf') {
    s += avHairShell(cx, hy, r, col, 0.5, 0.6, 1.8);
    // 결이 살아 있는 레이어드 앞머리 — 부드럽게 흐르는 선
    s += '<path d="M' + avn(cx - r * 0.97) + ' ' + avn(hy - r * 0.12) +
      ' C' + avn(cx - r * 0.94) + ' ' + avn(hy - r * 0.66) + ' ' + avn(cx - r * 0.4) + ' ' + avn(hy - r * 0.98) + ' ' + avn(cx + r * 0.12) + ' ' + avn(hy - r * 0.96) +
      ' C' + avn(cx + r * 0.72) + ' ' + avn(hy - r * 0.94) + ' ' + avn(cx + r * 0.98) + ' ' + avn(hy - r * 0.56) + ' ' + avn(cx + r * 0.97) + ' ' + avn(hy - r * 0.12) +
      ' C' + avn(cx + r * 0.82) + ' ' + avn(hy - r * 0.34) + ' ' + avn(cx + r * 0.62) + ' ' + avn(hy - r * 0.46) + ' ' + avn(cx + r * 0.4) + ' ' + avn(hy - r * 0.46) +
      ' C' + avn(cx + r * 0.16) + ' ' + avn(hy - r * 0.46) + ' ' + avn(cx - r * 0.04) + ' ' + avn(hy - r * 0.38) + ' ' + avn(cx - r * 0.26) + ' ' + avn(hy - r * 0.38) +
      ' C' + avn(cx - r * 0.52) + ' ' + avn(hy - r * 0.38) + ' ' + avn(cx - r * 0.74) + ' ' + avn(hy - r * 0.46) + ' ' + avn(cx - r * 0.94) + ' ' + avn(hy - r * 0.32) +
      ' Z" fill="' + col + '"/>';
    // 결 — 층이 진 머리카락 선
    s += '<path d="M' + avn(cx + r * 0.74) + ' ' + avn(hy - r * 0.78) + ' C' + avn(cx + r * 0.9) + ' ' + avn(hy - r * 0.5) + ' ' + avn(cx + r * 0.94) + ' ' + avn(hy - r * 0.28) + ' ' + avn(cx + r * 0.86) + ' ' + avn(hy - r * 0.12) +
      '" stroke="' + sh + '" stroke-width="' + avn(r * 0.075) + '" fill="none" stroke-linecap="round" opacity=".5"/>';
    s += '<path d="M' + avn(cx + r * 0.1) + ' ' + avn(hy - r * 0.86) + ' C' + avn(cx + r * 0.02) + ' ' + avn(hy - r * 0.66) + ' ' + avn(cx - r * 0.1) + ' ' + avn(hy - r * 0.52) + ' ' + avn(cx - r * 0.24) + ' ' + avn(hy - r * 0.4) +
      '" stroke="' + sh + '" stroke-width="' + avn(r * 0.07) + '" fill="none" stroke-linecap="round" opacity=".45"/>';
    s += '<path d="M' + avn(cx - r * 0.62) + ' ' + avn(hy - r * 0.8) + ' C' + avn(cx - r * 0.8) + ' ' + avn(hy - r * 0.6) + ' ' + avn(cx - r * 0.88) + ' ' + avn(hy - r * 0.48) + ' ' + avn(cx - r * 0.88) + ' ' + avn(hy - r * 0.36) +
      '" stroke="' + sh + '" stroke-width="' + avn(r * 0.07) + '" fill="none" stroke-linecap="round" opacity=".45"/>';
    // 귀 앞으로 흘러내린 옆머리
    s += '<path d="M' + avn(cx - r * 0.98) + ' ' + avn(hy - r * 0.12) +
      ' C' + avn(cx - r * 1.12) + ' ' + avn(hy + r * 0.2) + ' ' + avn(cx - r * 1.06) + ' ' + avn(hy + r * 0.44) + ' ' + avn(cx - r * 0.88) + ' ' + avn(hy + r * 0.66) +
      ' L' + avn(cx - r * 0.74) + ' ' + avn(hy + r * 0.34) +
      ' C' + avn(cx - r * 0.84) + ' ' + avn(hy + r * 0.14) + ' ' + avn(cx - r * 0.88) + ' ' + avn(hy + r * 0.02) + ' ' + avn(cx - r * 0.84) + ' ' + avn(hy - r * 0.12) + ' Z" fill="' + col + '"/>';
    s += '<path d="M' + avn(cx + r * 0.98) + ' ' + avn(hy - r * 0.12) +
      ' C' + avn(cx + r * 1.12) + ' ' + avn(hy + r * 0.2) + ' ' + avn(cx + r * 1.06) + ' ' + avn(hy + r * 0.44) + ' ' + avn(cx + r * 0.88) + ' ' + avn(hy + r * 0.66) +
      ' L' + avn(cx + r * 0.74) + ' ' + avn(hy + r * 0.34) +
      ' C' + avn(cx + r * 0.84) + ' ' + avn(hy + r * 0.14) + ' ' + avn(cx + r * 0.88) + ' ' + avn(hy + r * 0.02) + ' ' + avn(cx + r * 0.84) + ' ' + avn(hy - r * 0.12) + ' Z" fill="' + col + '"/>';
    s += '<path d="M' + avn(cx - r * 0.5) + ' ' + avn(hy - r * 1.04) + ' C' + avn(cx - r * 0.1) + ' ' + avn(hy - r * 0.9) + ' ' + avn(cx + r * 0.4) + ' ' + avn(hy - r * 0.92) + ' ' + avn(cx + r * 0.72) + ' ' + avn(hy - r * 0.72) +
      '" stroke="' + hi + '" stroke-width="' + avn(r * 0.07) + '" fill="none" stroke-linecap="round" opacity=".26"/>';
  } else if (a.hair === 'bob') {
    s += avHairShell(cx, hy, r, col, 0.82, 0.54, 1.7);
    // 턱선에서 둥글게 끝나는 옆머리
    s += '<path d="M' + avn(cx - r * 0.98) + ' ' + avn(hy - r * 0.2) +
      ' C' + avn(cx - r * 1.16) + ' ' + avn(hy + r * 0.24) + ' ' + avn(cx - r * 1.12) + ' ' + avn(hy + r * 0.66) + ' ' + avn(cx - r * 0.86) + ' ' + avn(hy + r * 0.9) +
      ' Q' + avn(cx - r * 0.66) + ' ' + avn(hy + r * 1.0) + ' ' + avn(cx - r * 0.62) + ' ' + avn(hy + r * 0.8) +
      ' C' + avn(cx - r * 0.78) + ' ' + avn(hy + r * 0.5) + ' ' + avn(cx - r * 0.84) + ' ' + avn(hy + r * 0.1) + ' ' + avn(cx - r * 0.8) + ' ' + avn(hy - r * 0.2) + ' Z" fill="' + col + '"/>';
    s += '<path d="M' + avn(cx + r * 0.98) + ' ' + avn(hy - r * 0.2) +
      ' C' + avn(cx + r * 1.16) + ' ' + avn(hy + r * 0.24) + ' ' + avn(cx + r * 1.12) + ' ' + avn(hy + r * 0.66) + ' ' + avn(cx + r * 0.86) + ' ' + avn(hy + r * 0.9) +
      ' Q' + avn(cx + r * 0.66) + ' ' + avn(hy + r * 1.0) + ' ' + avn(cx + r * 0.62) + ' ' + avn(hy + r * 0.8) +
      ' C' + avn(cx + r * 0.78) + ' ' + avn(hy + r * 0.5) + ' ' + avn(cx + r * 0.84) + ' ' + avn(hy + r * 0.1) + ' ' + avn(cx + r * 0.8) + ' ' + avn(hy - r * 0.2) + ' Z" fill="' + col + '"/>';
    // 가지런한 앞머리
    s += '<path d="M' + avn(cx - r * 0.97) + ' ' + avn(hy - r * 0.16) +
      ' C' + avn(cx - r * 0.9) + ' ' + avn(hy - r * 0.7) + ' ' + avn(cx - r * 0.3) + ' ' + avn(hy - r * 0.98) + ' ' + avn(cx + r * 0.2) + ' ' + avn(hy - r * 0.96) +
      ' C' + avn(cx + r * 0.76) + ' ' + avn(hy - r * 0.94) + ' ' + avn(cx + r * 0.97) + ' ' + avn(hy - r * 0.6) + ' ' + avn(cx + r * 0.97) + ' ' + avn(hy - r * 0.16) +
      ' Q' + avn(cx + r * 0.52) + ' ' + avn(hy - r * 0.46) + ' ' + avn(cx) + ' ' + avn(hy - r * 0.44) +
      ' Q' + avn(cx - r * 0.52) + ' ' + avn(hy - r * 0.46) + ' ' + avn(cx - r * 0.97) + ' ' + avn(hy - r * 0.16) + ' Z" fill="' + col + '"/>';
  } else if (a.hair === 'bun') {
    s += avHairShell(cx, hy, r, col, 0.22, 0.74, 1.2);
    // 옆 가르마 — 한쪽으로 넘긴 결
    s += '<path d="M' + avn(cx - r * 0.36) + ' ' + avn(hy - r * 1.24) +
      ' C' + avn(cx - r * 0.72) + ' ' + avn(hy - r * 0.9) + ' ' + avn(cx - r * 0.94) + ' ' + avn(hy - r * 0.5) + ' ' + avn(cx - r * 0.9) + ' ' + avn(hy - r * 0.06) +
      ' C' + avn(cx - r * 0.55) + ' ' + avn(hy - r * 0.44) + ' ' + avn(cx - r * 0.3) + ' ' + avn(hy - r * 0.82) + ' ' + avn(cx - r * 0.24) + ' ' + avn(hy - r * 1.18) + ' Z" fill="' + col + '"/>';
    s += '<path d="M' + avn(cx - r * 0.36) + ' ' + avn(hy - r * 1.22) +
      ' C' + avn(cx - r * 0.1) + ' ' + avn(hy - r * 0.94) + ' ' + avn(cx + r * 0.5) + ' ' + avn(hy - r * 0.9) + ' ' + avn(cx + r * 0.8) + ' ' + avn(hy - r * 0.56) + ' Z" fill="' + sh + '"/>';
    // 귀 앞 잔머리
    s += '<path d="M' + avn(cx - r * 0.94) + ' ' + avn(hy - r * 0.24) + ' L' + avn(cx - r * 0.88) + ' ' + avn(hy + r * 0.3) +
      ' Q' + avn(cx - r * 0.8) + ' ' + avn(hy + r * 0.38) + ' ' + avn(cx - r * 0.74) + ' ' + avn(hy + r * 0.26) +
      ' L' + avn(cx - r * 0.82) + ' ' + avn(hy - r * 0.24) + ' Z" fill="' + col + '"/>';
    s += '<path d="M' + avn(cx + r * 0.94) + ' ' + avn(hy - r * 0.24) + ' L' + avn(cx + r * 0.88) + ' ' + avn(hy + r * 0.3) +
      ' Q' + avn(cx + r * 0.8) + ' ' + avn(hy + r * 0.38) + ' ' + avn(cx + r * 0.74) + ' ' + avn(hy + r * 0.26) +
      ' L' + avn(cx + r * 0.82) + ' ' + avn(hy - r * 0.24) + ' Z" fill="' + col + '"/>';
    s += '<path d="M' + avn(cx + r * 0.1) + ' ' + avn(hy - r * 1.2) + ' C' + avn(cx + r * 0.45) + ' ' + avn(hy - r * 0.98) + ' ' + avn(cx + r * 0.72) + ' ' + avn(hy - r * 0.74) + ' ' + avn(cx + r * 0.86) + ' ' + avn(hy - r * 0.5) +
      '" stroke="' + hi + '" stroke-width="' + avn(r * 0.07) + '" fill="none" stroke-linecap="round" opacity=".26"/>';
  } else {
    // wave — 물결 펌
    s += avHairShell(cx, hy, r, col, 0.9, 0.56, 1.8);
    // 옆으로 흐르는 물결 결
    s += '<path d="M' + avn(cx - r * 1.02) + ' ' + avn(hy - r * 0.02) +
      ' C' + avn(cx - r * 1.12) + ' ' + avn(hy + r * 0.4) + ' ' + avn(cx - r * 1.0) + ' ' + avn(hy + r * 0.66) + ' ' + avn(cx - r * 0.9) + ' ' + avn(hy + r * 0.94) +
      '" stroke="' + sh + '" stroke-width="' + avn(r * 0.09) + '" fill="none" stroke-linecap="round" opacity=".55"/>';
    s += '<path d="M' + avn(cx + r * 1.02) + ' ' + avn(hy - r * 0.02) +
      ' C' + avn(cx + r * 1.12) + ' ' + avn(hy + r * 0.4) + ' ' + avn(cx + r * 1.0) + ' ' + avn(hy + r * 0.66) + ' ' + avn(cx + r * 0.9) + ' ' + avn(hy + r * 0.94) +
      '" stroke="' + sh + '" stroke-width="' + avn(r * 0.09) + '" fill="none" stroke-linecap="round" opacity=".55"/>';
    // 부드러운 가르마 앞머리
    s += '<path d="M' + avn(cx - r * 0.94) + ' ' + avn(hy - r * 0.18) +
      ' C' + avn(cx - r * 0.86) + ' ' + avn(hy - r * 0.74) + ' ' + avn(cx - r * 0.24) + ' ' + avn(hy - r * 0.99) + ' ' + avn(cx + r * 0.24) + ' ' + avn(hy - r * 0.96) +
      ' C' + avn(cx + r * 0.8) + ' ' + avn(hy - r * 0.92) + ' ' + avn(cx + r * 0.95) + ' ' + avn(hy - r * 0.58) + ' ' + avn(cx + r * 0.94) + ' ' + avn(hy - r * 0.18) +
      ' C' + avn(cx + r * 0.72) + ' ' + avn(hy - r * 0.5) + ' ' + avn(cx + r * 0.3) + ' ' + avn(hy - r * 0.4) + ' ' + avn(cx - r * 0.02) + ' ' + avn(hy - r * 0.52) +
      ' C' + avn(cx - r * 0.36) + ' ' + avn(hy - r * 0.66) + ' ' + avn(cx - r * 0.7) + ' ' + avn(hy - r * 0.44) + ' ' + avn(cx - r * 0.94) + ' ' + avn(hy - r * 0.18) + ' Z" fill="' + col + '"/>';
  }
  return s;
}

/* ─────────── 표정 ─────────── */
function avFace(kind, cx, hy, r) {
  const ex = r * 0.42;
  const ey = hy + r * 0.06;
  const mx = cx;
  const my = hy + r * 0.55;
  const erx = r * 0.105, ery = r * 0.135;
  let s = '';

  const eyeBall = function (x, y, rx, ry) {
    let e = '<ellipse cx="' + avn(x) + '" cy="' + avn(y) + '" rx="' + avn(rx) + '" ry="' + avn(ry) + '" fill="' + AV_INK + '"/>';
    e += '<circle cx="' + avn(x + rx * 0.35) + '" cy="' + avn(y - ry * 0.42) + '" r="' + avn(r * 0.035) + '" fill="#ffffff"/>';
    return e;
  };
  const brow = function (x, y, tilt) {
    return '<path d="M' + avn(x - r * 0.17) + ' ' + avn(y + tilt) + ' Q' + avn(x) + ' ' + avn(y - r * 0.07 + tilt) + ' ' + avn(x + r * 0.17) + ' ' + avn(y - tilt) + '" stroke="' + AV_INK + '" stroke-width="' + avn(r * 0.075) + '" fill="none" stroke-linecap="round" opacity=".85"/>';
  };
  /* 볼터치는 아주 옅게 — 성별 인상 없이 표정만 살린다 */
  const blush = '<ellipse cx="' + avn(cx - r * 0.62) + '" cy="' + avn(hy + r * 0.4) + '" rx="' + avn(r * 0.14) + '" ry="' + avn(r * 0.08) + '" fill="#f6a9a0" opacity=".32"/>' +
    '<ellipse cx="' + avn(cx + r * 0.62) + '" cy="' + avn(hy + r * 0.4) + '" rx="' + avn(r * 0.14) + '" ry="' + avn(r * 0.08) + '" fill="#f6a9a0" opacity=".32"/>';
  const LIP = '#8a5a4c';

  if (kind === 'smile') {
    s += brow(cx - ex, ey - r * 0.4, 0) + brow(cx + ex, ey - r * 0.4, 0);
    s += eyeBall(cx - ex, ey, erx, ery) + eyeBall(cx + ex, ey, erx, ery);
    s += blush;
    s += '<path d="M' + avn(mx - r * 0.24) + ' ' + avn(my - r * 0.06) + ' Q' + avn(mx) + ' ' + avn(my + r * 0.32) + ' ' + avn(mx + r * 0.24) + ' ' + avn(my - r * 0.06) +
      '" stroke="' + LIP + '" stroke-width="' + avn(r * 0.1) + '" fill="none" stroke-linecap="round"/>';
  } else if (kind === 'wink') {
    s += brow(cx - ex, ey - r * 0.4, 0) + brow(cx + ex, ey - r * 0.46, 0);
    s += eyeBall(cx - ex, ey, erx, ery);
    s += '<path d="M' + avn(cx + ex - r * 0.12) + ' ' + avn(ey) + ' Q' + avn(cx + ex) + ' ' + avn(ey - r * 0.15) + ' ' + avn(cx + ex + r * 0.12) + ' ' + avn(ey) +
      '" stroke="' + AV_INK + '" stroke-width="' + avn(r * 0.1) + '" fill="none" stroke-linecap="round"/>';
    s += blush;
    s += '<path d="M' + avn(mx - r * 0.2) + ' ' + avn(my) + ' Q' + avn(mx + r * 0.04) + ' ' + avn(my + r * 0.24) + ' ' + avn(mx + r * 0.22) + ' ' + avn(my - r * 0.04) +
      '" stroke="' + LIP + '" stroke-width="' + avn(r * 0.095) + '" fill="none" stroke-linecap="round"/>';
  } else if (kind === 'focus') {
    s += brow(cx - ex, ey - r * 0.34, r * 0.09) + brow(cx + ex, ey - r * 0.34, -r * 0.09);
    s += '<ellipse cx="' + avn(cx - ex) + '" cy="' + avn(ey) + '" rx="' + avn(r * 0.12) + '" ry="' + avn(r * 0.055) + '" fill="' + AV_INK + '"/>';
    s += '<ellipse cx="' + avn(cx + ex) + '" cy="' + avn(ey) + '" rx="' + avn(r * 0.12) + '" ry="' + avn(r * 0.055) + '" fill="' + AV_INK + '"/>';
    s += '<path d="M' + avn(mx - r * 0.15) + ' ' + avn(my + r * 0.06) + ' L' + avn(mx + r * 0.15) + ' ' + avn(my + r * 0.06) +
      '" stroke="' + LIP + '" stroke-width="' + avn(r * 0.09) + '" stroke-linecap="round"/>';
  } else if (kind === 'wow') {
    s += brow(cx - ex, ey - r * 0.52, 0) + brow(cx + ex, ey - r * 0.52, 0);
    s += '<circle cx="' + avn(cx - ex) + '" cy="' + avn(ey) + '" r="' + avn(r * 0.17) + '" fill="#ffffff" stroke="' + AV_INK + '" stroke-width="' + avn(r * 0.04) + '"/>';
    s += '<circle cx="' + avn(cx + ex) + '" cy="' + avn(ey) + '" r="' + avn(r * 0.17) + '" fill="#ffffff" stroke="' + AV_INK + '" stroke-width="' + avn(r * 0.04) + '"/>';
    s += '<circle cx="' + avn(cx - ex) + '" cy="' + avn(ey) + '" r="' + avn(r * 0.085) + '" fill="' + AV_INK + '"/>';
    s += '<circle cx="' + avn(cx + ex) + '" cy="' + avn(ey) + '" r="' + avn(r * 0.085) + '" fill="' + AV_INK + '"/>';
    s += blush;
    s += '<ellipse cx="' + avn(mx) + '" cy="' + avn(my + r * 0.05) + '" rx="' + avn(r * 0.14) + '" ry="' + avn(r * 0.18) + '" fill="#a85452"/>';
    s += '<ellipse cx="' + avn(mx) + '" cy="' + avn(my + r * 0.13) + '" rx="' + avn(r * 0.1) + '" ry="' + avn(r * 0.07) + '" fill="#e08f8c"/>';
    s += '<path d="M' + avn(cx + r * 0.78) + ' ' + avn(hy - r * 0.7) + ' l' + avn(r * 0.05) + ' ' + avn(r * 0.16) + ' l' + avn(r * 0.16) + ' ' + avn(r * 0.05) +
      ' l' + avn(-r * 0.16) + ' ' + avn(r * 0.05) + ' l' + avn(-r * 0.05) + ' ' + avn(r * 0.16) + ' l' + avn(-r * 0.05) + ' ' + avn(-r * 0.16) +
      ' l' + avn(-r * 0.16) + ' ' + avn(-r * 0.05) + ' l' + avn(r * 0.16) + ' ' + avn(-r * 0.05) + ' Z" fill="#fbbf24"/>';
    s += '<path d="M' + avn(cx - r * 1.2) + ' ' + avn(hy - r * 0.55) + ' l' + avn(r * 0.04) + ' ' + avn(r * 0.12) + ' l' + avn(r * 0.12) + ' ' + avn(r * 0.04) +
      ' l' + avn(-r * 0.12) + ' ' + avn(r * 0.04) + ' l' + avn(-r * 0.04) + ' ' + avn(r * 0.12) + ' l' + avn(-r * 0.04) + ' ' + avn(-r * 0.12) +
      ' l' + avn(-r * 0.12) + ' ' + avn(-r * 0.04) + ' l' + avn(r * 0.12) + ' ' + avn(-r * 0.04) + ' Z" fill="#fbbf24"/>';
  } else {
    // tongue
    s += brow(cx - ex, ey - r * 0.44, 0) + brow(cx + ex, ey - r * 0.44, 0);
    s += '<path d="M' + avn(cx - ex - r * 0.12) + ' ' + avn(ey + r * 0.02) + ' Q' + avn(cx - ex) + ' ' + avn(ey - r * 0.16) + ' ' + avn(cx - ex + r * 0.12) + ' ' + avn(ey + r * 0.02) +
      '" stroke="' + AV_INK + '" stroke-width="' + avn(r * 0.1) + '" fill="none" stroke-linecap="round"/>';
    s += eyeBall(cx + ex, ey, erx * 0.95, ery * 0.95);
    s += blush;
    s += '<path d="M' + avn(mx - r * 0.22) + ' ' + avn(my - r * 0.1) + ' Q' + avn(mx) + ' ' + avn(my + r * 0.28) + ' ' + avn(mx + r * 0.22) + ' ' + avn(my - r * 0.1) + ' Z" fill="#a85452"/>';
    s += '<ellipse cx="' + avn(mx) + '" cy="' + avn(my + r * 0.17) + '" rx="' + avn(r * 0.1) + '" ry="' + avn(r * 0.09) + '" fill="#e08f8c"/>';
  }
  return s;
}

/* ─────────── 완성 ─────────── */
function avSVG(value, opt) {
  const a = normalizeAvatar(value);
  if (a.emoji) return '';
  const o = opt || {};
  const b = AV_BODY[a.body];
  const cx = 50, r = b.r, hy = b.hy;
  const hair = AV_HAIR_COLOR[a.hair];
  const st = AV_STYLE[a.style];
  const uid = 'avc' + (++AV_UID);

  let g = '';
  g += avHairBack(a, cx, hy, r, hair);
  g += avTorso(a, b, st);
  // 목
  g += '<rect x="' + avn(cx - b.nw) + '" y="' + avn(hy + r * 0.62) + '" width="' + avn(b.nw * 2) +
    '" height="' + avn(b.sy - (hy + r * 0.62) + 6) + '" rx="' + avn(b.nw * 0.8) + '" fill="' + AV_SKIN2 + '"/>';
  // 귀
  g += '<circle cx="' + avn(cx - r * 0.99) + '" cy="' + avn(hy + r * 0.12) + '" r="' + avn(r * 0.17) + '" fill="' + AV_SKIN2 + '"/>';
  g += '<circle cx="' + avn(cx + r * 0.99) + '" cy="' + avn(hy + r * 0.12) + '" r="' + avn(r * 0.17) + '" fill="' + AV_SKIN2 + '"/>';
  // 얼굴
  g += '<ellipse cx="' + cx + '" cy="' + avn(hy) + '" rx="' + avn(r) + '" ry="' + avn(r * 1.03) + '" fill="' + AV_SKIN + '"/>';
  g += avHairFront(a, cx, hy, r, hair);
  g += avFace(a.expr, cx, hy, r);

  const views = {
    full: '0 0 100 100',
    head: '18 12 64 64',
    body: '6 6 88 88',
    torso: '15 52 70 52'
  };
  const vb = o.viewBox || views[o.view] || views.full;

  return '<svg class="av-svg" viewBox="' + vb + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
    '<defs><clipPath id="' + uid + '"><circle cx="50" cy="50" r="49.6"/></clipPath></defs>' +
    '<g clip-path="url(#' + uid + ')">' + g + '</g>' +
    '</svg>';
}

  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 O·0·I·1 제외
  const MAX_PLAYERS = 40;
  const SIDE_O = 0.35;   // u < 0.35  → O
  const SIDE_X = 0.65;   // u > 0.65  → X
  const LS_QUESTIONS = 'oxquiz.questions.v1';
  const LS_NICK = 'oxquiz.nick';
  const LS_AVATAR = 'oxquiz.avatar';
  const SS_ROOM = 'oxquiz.hostcode';

  const DEFAULT_QUESTIONS = [
    { text: '대한민국의 수도는 서울이다.', answer: 'O' },
    { text: '펭귄은 하늘을 날 수 있다.', answer: 'X' },
    { text: '바나나는 나무에서 열린다.', answer: 'X' },
    { text: '거미는 곤충이다.', answer: 'X' },
    { text: '세종대왕은 훈민정음을 만들었다.', answer: 'O' }
  ];

  const SCREENS = {
    landing: 'screen-landing',
    join: 'screen-join',
    student: 'screen-student',
    host: 'screen-host'
  };

  /* ─────────── 상태 ─────────── */
  const S = {
    role: null,               // 'host' | 'student'
    code: '',
    peer: null,
    conns: new Map(),         // host: peerId → DataConnection
    conn: null,               // student: 호스트와의 연결
    players: new Map(),       // host: peerId→p / student: n→p
    nseq: 1,
    phase: 'lobby',           // lobby | q | r
    qi: 0,
    qAnswer: null,            // 정답(호스트만 알고 있음)
    answer: null,             // 학생에게 공개된 정답
    timer: { dur: 0, endAt: 0 },
    timerSel: 0,
    timerDur: 0,
    rem: 0,
    remAt: 0,
    questions: [],
    myN: null,
    myName: '나',
    myAvatar: '🙂',
    me: { u: 0.5, v: 0.5 },
    qText: '',
    qNo: 0,
    editIndex: null,
    editAnswer: 'O',
    lastScore: 0,
    dirty: true,
    lastSend: 0,
    joined: false
  };

  /* ─────────── 화면 / 토스트 ─────────── */
  function show(name) {
    Object.keys(SCREENS).forEach(function (k) {
      const el = document.getElementById(SCREENS[k]);
      if (el) el.hidden = k !== name;
    });
    document.body.classList.toggle('locked', name === 'student' || name === 'host');
  }

  let toastTimer = null;
  function toast(msg, ms) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.hidden = true; }, 240);
    }, ms || 2200);
  }

  function openModal(id) { const m = document.getElementById(id); if (m) m.hidden = false; }
  function closeModal(id) { const m = document.getElementById(id); if (m) m.hidden = true; }

  /* ─────────── 아레나(무대) 공용 렌더러 ─────────── */
  function createArena(root) {
    const layer = $('.avatar-layer', root);
    const els = new Map();
    let lastList = [];
    let lastOpts = {};

    function isVertical() {
      const r = root.getBoundingClientRect();
      return r.height >= r.width;
    }

    function update(list, opts) {
      lastList = list || lastList;
      lastOpts = opts || lastOpts;
      const vert = isVertical();
      root.classList.toggle('vertical', vert);
      root.classList.toggle('horizontal', !vert);

      const n = lastList.length;
      const size = n >= 30 ? 30 : n >= 24 ? 34 : n >= 16 ? 38 : n >= 9 ? 44 : 54;
      layer.style.setProperty('--av', size + 'px');

      const seen = {};
      lastList.forEach(function (p) {
        seen[p.id] = 1;
        let el = els.get(p.id);
        if (!el) {
          el = document.createElement('div');
          el.className = 'avatar';
          el.innerHTML = '<div class="face"><span class="av-in"></span></div><span class="nm"></span><span class="mk">✨</span>';
          layer.appendChild(el);
          els.set(p.id, el);
        }
        const face = $('.av-in', el);
        const nm = $('.nm', el);
        const avk = avatarKey(p.avatar);
        if (el.dataset.avk !== avk) {
          el.dataset.avk = avk;
          face.innerHTML = avatarMarkup(p.avatar);
        }
        if (nm.textContent !== p.name) nm.textContent = p.name || '';

        el.classList.toggle('side-o', p.side === 'O');
        el.classList.toggle('side-x', p.side === 'X');
        el.classList.toggle('me', p.id === lastOpts.me);
        el.classList.toggle('winner', !!p.winner);
        el.classList.toggle('dim', !!(lastOpts.answer && p.side && p.side !== lastOpts.answer));

        const up = clamp(p.u, 0, 1) * 100;
        const vp = clamp(p.v, 0, 1) * 100;
        el.style.left = (vert ? vp : up) + '%';
        el.style.top = (vert ? up : vp) + '%';
      });

      els.forEach(function (el, id) {
        if (!seen[id]) { if (el.parentNode) el.parentNode.removeChild(el); els.delete(id); }
      });
    }

    function toUV(clientX, clientY) {
      const r = root.getBoundingClientRect();
      const px = (clientX - r.left) / Math.max(1, r.width);
      const py = (clientY - r.top) / Math.max(1, r.height);
      const vert = isVertical();
      return {
        u: clamp(vert ? py : px, 0.02, 0.98),
        v: clamp(vert ? px : py, 0.05, 0.95)
      };
    }

    return {
      root: root,
      update: update,
      toUV: toUV,
      isVertical: isVertical,
      redraw: function () { update(lastList, lastOpts); }
    };
  }

  const hostArena = createArena(document.getElementById('h-arena'));
  const stuArena = createArena(document.getElementById('s-arena'));

  /* ─────────── 문제 저장소 ─────────── */
  function loadQuestions() {
    try {
      const raw = localStorage.getItem(LS_QUESTIONS);
      if (!raw) return DEFAULT_QUESTIONS.map(function (q) { return { text: q.text, answer: q.answer }; });
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return DEFAULT_QUESTIONS.slice();
      return arr
        .filter(function (q) { return q && typeof q.text === 'string' && q.text.trim(); })
        .map(function (q) {
          return { text: String(q.text).slice(0, 140), answer: q.answer === 'X' ? 'X' : 'O' };
        });
    } catch (e) {
      return DEFAULT_QUESTIONS.slice();
    }
  }
  function saveQuestions() {
    try { localStorage.setItem(LS_QUESTIONS, JSON.stringify(S.questions)); } catch (e) {}
  }

  /* ─────────── 공통 계산 ─────────── */
  function sideOf(u) {
    if (u === null || u === undefined) return null;
    if (u < SIDE_O) return 'O';
    if (u > SIDE_X) return 'X';
    return null;
  }
  function genCode(len) {
    let s = '';
    for (let i = 0; i < (len || 4); i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return s;
  }
  function sanitizeName(v) {
    const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 10);
    return s || '학생';
  }
  function hostPeerId(code) { return 'oxq' + String(code).toLowerCase(); }

  function joinUrl() {
    return location.origin + location.pathname + '?room=' + S.code;
  }

  /* ═══════════════════════════════════════════
     방장(선생님)
     ═══════════════════════════════════════════ */
  function startHost(forceCode) {
    if (!window.Peer) {
      toast('연결 프로그램을 불러오지 못했어요. 새로고침해 주세요.', 4000);
      return;
    }
    let code = forceCode || '';
    if (!code) {
      try { code = sessionStorage.getItem(SS_ROOM) || ''; } catch (e) { code = ''; }
    }
    if (!code) code = genCode(4);
    S.code = code;
    S.role = 'host';

    const peer = new Peer(hostPeerId(code), { debug: 1 });
    S.peer = peer;
    let opened = false;

    peer.on('open', function () {
      opened = true;
      try { sessionStorage.setItem(SS_ROOM, code); } catch (e) {}
      show('host');
      $('#h-code').textContent = code;
      $('#h-code2').textContent = code;
      makeQR();
      renderHost();
      toast('방이 만들어졌어요! 코드 ' + code, 2600);
    });

    peer.on('error', function (err) {
      console.warn('[peer]', err && err.type, err && err.message);
      if (!opened && err && err.type === 'unavailable-id') {
        // 이미 쓰이는 코드 → 새 코드로 재시도
        try { peer.destroy(); } catch (e) {}
        try { sessionStorage.removeItem(SS_ROOM); } catch (e) {}
        setTimeout(function () { startHost(''); }, 120);
        return;
      }
      if (err && (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error')) {
        toast('연결 서버와 통신이 잠시 끊겼어요. 자동으로 다시 연결할게요.', 3500);
      }
    });

    peer.on('disconnected', function () {
      try { peer.reconnect(); } catch (e) {}
    });

    peer.on('connection', function (conn) {
      conn.on('data', function (d) { handleHostData(conn, d); });
      conn.on('close', function () { removePlayer(conn.peer); });
      conn.on('error', function () { removePlayer(conn.peer); });
    });
  }

  function removePlayer(peerId) {
    if (!S.players.has(peerId)) return;
    const p = S.players.get(peerId);
    S.players.delete(peerId);
    S.conns.delete(peerId);
    toast(p.name + ' 님이 나갔어요');
    broadcast(rosterMsg());
    S.dirty = true;
    renderHost();
  }

  function handleHostData(conn, d) {
    if (!d || typeof d !== 'object') return;

    if (d.t === 'join') {
      if (S.players.has(conn.peer)) return;
      if (S.players.size >= MAX_PLAYERS) {
        try { conn.send({ t: 'err', msg: '방이 가득 찼어요 (최대 ' + MAX_PLAYERS + '명)' }); } catch (e) {}
        setTimeout(function () { try { conn.close(); } catch (e) {} }, 600);
        return;
      }
      const p = {
        id: conn.peer,
        n: S.nseq++,
        name: sanitizeName(d.name),
        avatar: normalizeAvatar(d.avatar),
        u: 0.5,
        v: 0.5,
        score: 0,
        side: null
      };
      S.players.set(conn.peer, p);
      S.conns.set(conn.peer, conn);
      try {
        conn.send({ t: 'you', n: p.n });
        conn.send(rosterMsg());
        conn.send(tickMsg());
      } catch (e) {}
      broadcast(rosterMsg());
      S.dirty = true;
      renderHost();
      toast(p.name + ' 님 입장! 🎉', 1500);
      return;
    }

    if (d.t === 'pos') {
      const p = S.players.get(conn.peer);
      if (!p || S.phase === 'r') return;
      const u = Number(d.u);
      const v = Number(d.v);
      p.u = clamp(isFinite(u) ? u : p.u, 0.02, 0.98);
      p.v = clamp(isFinite(v) ? v : p.v, 0.05, 0.95);
      p.side = sideOf(p.u);
      S.dirty = true;
    }
  }

  function rosterMsg() {
    const rows = [];
    S.players.forEach(function (p) { rows.push([p.n, p.name, p.avatar]); });
    return { t: 'roster', pl: rows };
  }

  function tickMsg() {
    const rows = [];
    S.players.forEach(function (p) {
      rows.push([p.n, Math.round(p.u * 100) / 100, Math.round(p.v * 100) / 100, p.score, p.side === 'O' ? 1 : p.side === 'X' ? 2 : 0]);
    });
    const m = { t: 's', ph: S.phase, pl: rows };
    if (S.phase === 'q' || S.phase === 'r') {
      const q = S.questions[S.qi];
      m.qi = S.qi;
      m.qn = S.qi + 1;
      m.qt = q ? q.text : '';
      if (S.phase === 'r') m.ans = S.qAnswer;
      if (S.phase === 'q') {
        m.dur = S.timer.dur;
        if (S.timer.endAt) m.rem = Math.max(0, S.timer.endAt - now());
      }
    }
    return m;
  }

  function broadcast(msg) {
    S.conns.forEach(function (c) {
      if (c && c.open) { try { c.send(msg); } catch (e) {} }
    });
  }

  /* ── 방장 동작 ── */
  function resetPositions() {
    const list = [];
    S.players.forEach(function (p) { list.push(p); });
    const n = Math.max(1, list.length);
    const cols = Math.max(2, Math.ceil(Math.sqrt(n * 2.2)));
    const rows = Math.max(1, Math.ceil(n / cols));
    list.forEach(function (p, i) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      p.u = 0.40 + ((c + 0.5) / cols) * 0.20;
      p.v = 0.12 + ((r + 0.5) / rows) * 0.76;
      p.side = null;
    });
    S.dirty = true;
  }

  function askQuestion() {
    if (!S.questions.length) { toast('문제를 먼저 추가해 주세요.'); return; }
    if (S.phase !== 'lobby') { toast('이미 출제했어요. “다음 문제”를 눌러 주세요.'); return; }
    const q = S.questions[S.qi];
    if (!q) return;
    S.phase = 'q';
    S.qAnswer = q.answer === 'X' ? 'X' : 'O';
    S.answer = null;
    resetPositions();
    const dur = Number(S.timerSel) || 0;
    S.timer = { dur: dur, endAt: dur ? now() + dur * 1000 : 0 };
    S.dirty = true;
    S.lastSend = 0;
    hideHostReveal();
    renderHost();
    broadcast(tickMsg());
    S.lastSend = now();
    toast('문제 ' + (S.qi + 1) + ' 출제!', 1600);
  }

  function revealAnswer() {
    if (S.phase !== 'q') { toast('출제 중일 때만 정답을 공개할 수 있어요.'); return; }
    S.phase = 'r';
    S.answer = S.qAnswer;
    S.timer = { dur: 0, endAt: 0 };
    let win = 0;
    S.players.forEach(function (p) {
      if (p.side === S.qAnswer) { p.score += 10; win++; }
    });
    broadcast({ t: 'rev', ans: S.qAnswer, win: win });
    broadcast(rosterMsg());
    S.dirty = true;
    S.lastSend = 0;
    showHostReveal(win);
    renderHost();
    broadcast(tickMsg());
    S.lastSend = now();
  }

  function nextQuestion() {
    if (!S.questions.length) { toast('문제가 없어요.'); return; }
    const last = S.questions.length - 1;
    if (S.qi >= last) {
      S.qi = 0;
      toast('첫 문제로 돌아왔어요.');
    } else {
      S.qi += 1;
    }
    S.phase = 'lobby';
    S.qAnswer = null;
    S.answer = null;
    S.timer = { dur: 0, endAt: 0 };
    resetPositions();
    hideHostReveal();
    S.dirty = true;
    S.lastSend = 0;
    renderHost();
    broadcast(tickMsg());
    S.lastSend = now();
  }

  let hostRevealEl = null;
  function showHostReveal(win) {
    if (!hostRevealEl) {
      hostRevealEl = document.createElement('div');
      hostRevealEl.className = 'reveal-card';
      hostRevealEl.style.top = '15%';
      document.getElementById('h-arena').appendChild(hostRevealEl);
    }
    hostRevealEl.hidden = false;
    hostRevealEl.innerHTML = '';
    const b = document.createElement('div');
    b.className = 'big-ans ' + (S.qAnswer === 'O' ? 'o' : 'x');
    b.textContent = '정답은 ' + S.qAnswer + '!';
    hostRevealEl.appendChild(b);
    if (win) {
      const s = document.createElement('div');
      s.className = 'res win';
      s.textContent = win + '명 정답 · +10점 🎉';
      hostRevealEl.appendChild(s);
    }
    hostArena.redraw();
  }
  function hideHostReveal() {
    if (hostRevealEl) hostRevealEl.hidden = true;
  }

  function hostArenaList() {
    const out = [];
    const ans = S.phase === 'r' ? S.qAnswer : null;
    S.players.forEach(function (p) {
      out.push({
        id: p.id, name: p.name, avatar: p.avatar, u: p.u, v: p.v, side: p.side,
        winner: !!(ans && p.side === ans)
      });
    });
    return out;
  }

  function renderHostArena() {
    hostArena.update(hostArenaList(), { me: null, phase: S.phase, answer: S.phase === 'r' ? S.qAnswer : null });
    const hint = $('#h-hint');
    if (hint) hint.classList.toggle('hide', S.players.size > 0);
    $('#h-count').textContent = S.players.size;
  }

  function statusText() {
    if (S.phase === 'q') {
      if (S.timer.endAt) {
        const left = Math.ceil(Math.max(0, S.timer.endAt - now()) / 1000);
        return '⏱ ' + left + '초 · 학생들이 O / X로 이동 중';
      }
      return '✋ 정답을 기다리는 중 · “정답 공개”를 눌러 주세요';
    }
    if (S.phase === 'r') {
      let win = 0;
      S.players.forEach(function (p) { if (p.side === S.qAnswer) win++; });
      return '🎉 정답은 ' + S.qAnswer + ' · ' + win + '명이 +10점!';
    }
    return S.players.size
      ? '👋 ' + S.players.size + '명 접속 · “출제하기”를 눌러 주세요'
      : '학생들이 이곳으로 들어와요';
  }

  function renderHostBar() {
    $('#h-count').textContent = S.players.size;

    let o = 0, x = 0, n = 0;
    S.players.forEach(function (p) {
      if (p.side === 'O') o++;
      else if (p.side === 'X') x++;
      else n++;
    });
    $('#h-o').textContent = o;
    $('#h-x').textContent = x;
    $('#h-n').textContent = n;

    const st = $('#h-status');
    st.textContent = statusText();
    st.classList.toggle('live', S.phase === 'q');
    st.classList.toggle('reveal', S.phase === 'r');
  }

  function renderHost() {
    $('#h-code').textContent = S.code || '----';
    $('#h-code2').textContent = S.code || '----';
    renderQPreview();
    renderQList();
    $('#btn-ask').disabled = !S.questions.length || S.phase !== 'lobby';
    $('#btn-reveal').disabled = S.phase !== 'q';
    renderHostArena();
    renderHostBar();
    if (S.phase !== 'r') hideHostReveal();
  }

  function renderQPreview() {
    const q = S.questions[S.qi];
    const pv = $('#h-qpreview');
    if (pv) {
      pv.textContent = q ? q.text : '문제를 추가해 주세요';
      pv.style.color = q ? '' : '#94a3b8';
    }
    const pos = $('#h-qpos');
    if (pos) pos.textContent = (S.questions.length ? S.qi + 1 : 0) + ' / ' + S.questions.length;
    const ans = $('#h-qans');
    if (ans) {
      ans.hidden = !q;
      if (q) {
        ans.textContent = q.answer;
        ans.className = 'ans-chip ' + (q.answer === 'X' ? 'x' : 'o');
      }
    }
  }

  function renderQList() {
    const ul = $('#h-qlist');
    if (!ul) return;
    ul.innerHTML = '';
    S.questions.forEach(function (q, i) {
      const li = document.createElement('li');
      li.className = 'q-item' + (i === S.qi ? ' cur' : '');

      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'q-pick';
      pick.dataset.i = String(i);
      const idx = document.createElement('span');
      idx.className = 'idx';
      idx.textContent = String(i + 1);
      const tx = document.createElement('span');
      tx.className = 'tx';
      tx.textContent = q.text;
      pick.appendChild(idx);
      pick.appendChild(tx);

      const chip = document.createElement('span');
      chip.className = 'ans-chip ' + (q.answer === 'X' ? 'x' : 'o');
      chip.textContent = q.answer;

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'q-edit';
      edit.dataset.i = String(i);
      edit.title = '수정';
      edit.textContent = '✏️';

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'q-del';
      del.dataset.i = String(i);
      del.title = '삭제';
      del.textContent = '🗑';

      li.appendChild(pick);
      li.appendChild(chip);
      li.appendChild(edit);
      li.appendChild(del);
      ul.appendChild(li);
    });
  }

  function makeQR() {
    const box = $('#h-qr');
    if (!box) return;
    box.innerHTML = '';
    const url = joinUrl();
    const tiny = document.createElement('p');
    tiny.className = 'tiny';
    if (window.QRCode && window.QRCode.CorrectLevel) {
      try {
        new window.QRCode(box, {
          text: url,
          width: 168,
          height: 168,
          colorDark: '#1e1b4b',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.M
        });
      } catch (e) {
        tiny.textContent = 'QR을 만들지 못했어요. 링크를 복사해 주세요.';
        box.appendChild(tiny);
      }
    } else {
      tiny.textContent = 'QR을 불러오지 못했어요. 링크를 복사해 주세요.';
      box.appendChild(tiny);
    }
    $('#h-url').textContent = url;
  }

  function copyLink() {
    const url = joinUrl();
    const done = function () { toast('참여 링크를 복사했어요! 🔗'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url); });
    } else {
      fallbackCopy(url);
    }
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    toast(ok ? '참여 링크를 복사했어요! 🔗' : '링크: ' + text, ok ? 2200 : 6000);
  }

  function renderRank() {
    const list = [];
    S.players.forEach(function (p) { list.push(p); });
    list.sort(function (a, b) { return b.score - a.score || a.name.localeCompare(b.name); });
    const ol = $('#rank-list');
    ol.innerHTML = '';
    if (!list.length) {
      const li = document.createElement('li');
      li.textContent = '아직 참여한 학생이 없어요.';
      ol.appendChild(li);
      return;
    }
    list.forEach(function (p, i) {
      const li = document.createElement('li');
      const rk = document.createElement('span');
      rk.className = 'rk';
      rk.textContent = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
      const av = document.createElement('span');
      av.className = 'av';
      av.innerHTML = avatarMarkup(p.avatar);
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = p.name;
      const sc = document.createElement('span');
      sc.className = 'sc';
      sc.textContent = p.score + '점';
      li.appendChild(rk); li.appendChild(av); li.appendChild(nm); li.appendChild(sc);
      ol.appendChild(li);
    });
  }

  /* ── 방장 루프(실시간 동기화) ── */
  function hostLoop() {
    if (S.role !== 'host') return;
    const t = now();
    if (S.phase === 'q' && S.timer.endAt) {
      if (S.timer.endAt <= t) { revealAnswer(); return; }
      S.dirty = true;
    }
    if (S.dirty || t - S.lastSend > 1300) {
      renderHostArena();
      renderHostBar();
      broadcast(tickMsg());
      S.lastSend = t;
      S.dirty = false;
    }
  }

  /* ═══════════════════════════════════════════
     학생
     ═══════════════════════════════════════════ */
  function startStudent(code, name, avatar) {
    if (!window.Peer) {
      setJoinStatus('연결 프로그램을 불러오지 못했어요. 새로고침해 주세요.', true);
      return;
    }
    S.role = 'student';
    S.code = code;
    S.myName = name;
    S.myAvatar = avatar;
    S.joined = false;
    S.players = new Map();
    S.myN = null;
    S.me = { u: 0.5, v: 0.5 };
    S.phase = 'lobby';
    S.revealSig = '';

    setJoinStatus('방을 찾는 중…', false, 'busy');
    setJoinBusy(true);

    const peer = new Peer({ debug: 1 });
    S.peer = peer;

    const fail = function (msg) {
      if (S.joined) return;
      clearTimeout(S.joinTimer);
      setJoinBusy(false);
      setJoinStatus(msg, true);
      try { peer.destroy(); } catch (e) {}
      if (S.peer === peer) S.peer = null;
      S.conn = null;
      S.role = null;
    };

    S.joinTimer = setTimeout(function () {
      fail('응답이 없어요. 방 코드를 확인하고 다시 시도해 주세요.');
    }, 15000);

    peer.on('open', function () {
      const conn = peer.connect(hostPeerId(code), { reliable: true });
      S.conn = conn;

      conn.on('open', function () {
        try { conn.send({ t: 'join', name: name, avatar: avatar }); } catch (e) {}
      });

      conn.on('data', function (d) { handleStudentData(d, fail); });

      conn.on('close', function () {
        if (!S.joined) { fail('방에 연결하지 못했어요.'); return; }
        if (S.role === 'student') studentLost();
      });

      conn.on('error', function () {
        if (!S.joined) fail('방에 연결하지 못했어요. 코드를 확인해 주세요.');
      });
    });

    peer.on('error', function (err) {
      console.warn('[peer]', err && err.type, err && err.message);
      if (err && err.type === 'peer-unavailable') {
        fail('방을 찾을 수 없어요. 코드를 다시 확인해 주세요.');
        return;
      }
      if (err && (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error')) {
        fail('연결 서버에 문제가 있어요. 잠시 후 다시 시도해 주세요.');
      }
    });
  }

  function setJoinStatus(msg, isErr, cls) {
    const el = $('#join-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('err', !!isErr);
    el.classList.toggle('busy', cls === 'busy');
  }
  function setJoinBusy(busy) {
    const b = $('#btn-join-go');
    if (!b) return;
    b.disabled = busy;
    b.textContent = busy ? '연결 중…' : '입장하기 🚀';
  }

  function handleStudentData(d, failFn) {
    if (!d || typeof d !== 'object') return;

    if (d.t === 'you') {
      S.myN = d.n;
      S.joined = true;
      clearTimeout(S.joinTimer);
      $('#s-me-name').textContent = S.myName;
      $('#s-me-avatar').innerHTML = avatarMarkup(S.myAvatar);
      setJoinStatus('');
      setJoinBusy(false);
      show('student');
      history.replaceState(null, '', location.pathname + '?room=' + S.code);
      S.lastScore = 0;
      $('#s-score').textContent = '0';
      renderStudent();
      return;
    }
    if (d.t === 'roster') { applyRoster(d); renderStudent(); return; }
    if (d.t === 's') { applyTick(d); renderStudent(); return; }
    if (d.t === 'rev') {
      S.phase = 'r';
      S.answer = d.ans === 'X' ? 'X' : 'O';
      renderStudent();
      return;
    }
    if (d.t === 'err') {
      if (failFn) failFn(d.msg || '입장할 수 없어요.');
      else { toast(d.msg || '입장할 수 없어요.', 3500); }
      return;
    }
    if (d.t === 'bye') {
      toast('선생님이 방을 닫았어요.', 3000);
      setTimeout(function () { leaveStudent(true); }, 1400);
    }
  }

  function applyRoster(m) {
    const rows = m.pl || [];
    const ids = {};
    rows.forEach(function (r) {
      const n = r[0], name = r[1], av = r[2];
      ids[n] = 1;
      let p = S.players.get(n);
      if (!p) {
        p = { n: n, name: name, avatar: av, u: 0.5, v: 0.5, score: 0, side: null };
        S.players.set(n, p);
      } else {
        p.name = name;
        p.avatar = av;
      }
    });
    Array.from(S.players.keys()).forEach(function (k) {
      if (!ids[k]) S.players.delete(k);
    });
  }

  function applyTick(m) {
    S.phase = m.ph;
    S.answer = m.ph === 'r' ? (m.ans === 'X' ? 'X' : 'O') : null;
    if (m.qt !== undefined) { S.qText = m.qt; S.qNo = m.qn || 1; }
    if (m.ph === 'q') {
      S.timerDur = Number(m.dur) || 0;
      if (typeof m.rem === 'number') { S.rem = m.rem; S.remAt = perf(); }
    } else {
      S.timerDur = 0;
      S.rem = 0;
    }

    const next = new Map();
    (m.pl || []).forEach(function (r) {
      const n = r[0];
      const old = S.players.get(n);
      const p = old || { n: n, name: '학생', avatar: Object.assign({}, AV_DEFAULT), u: 0.5, v: 0.5, score: 0, side: null };
      p.u = r[1];
      p.v = r[2];
      p.score = r[3];
      p.side = r[4] === 1 ? 'O' : r[4] === 2 ? 'X' : null;
      next.set(n, p);
    });
    S.players = next;
  }

  function studentList() {
    const out = [];
    const ans = S.phase === 'r' ? S.answer : null;
    S.players.forEach(function (p) {
      const isMe = p.n === S.myN;
      const u = isMe ? S.me.u : p.u;
      const v = isMe ? S.me.v : p.v;
      out.push({
        id: 'p' + p.n,
        name: p.name,
        avatar: p.avatar,
        u: u,
        v: v,
        side: sideOf(u),
        winner: !!(ans && sideOf(u) === ans)
      });
    });
    return out;
  }

  function renderStudentArena() {
    stuArena.update(studentList(), { me: 'p' + S.myN, phase: S.phase, answer: S.phase === 'r' ? S.answer : null });
  }

  function renderStudent() {
    // 상단 문제 바
    if (S.phase === 'q' || S.phase === 'r') {
      $('#s-qno').textContent = 'Q' + (S.qNo || 1);
      $('#s-qtext').textContent = S.qText || '문제';
    } else {
      $('#s-qno').textContent = '대기 중';
      $('#s-qtext').textContent = '선생님이 곧 시작해요!';
    }

    // 힌트
    const hint = $('#s-hint');
    if (S.phase === 'lobby') {
      hint.textContent = '가운데에서 대기!';
      hint.classList.remove('hide');
    } else if (S.phase === 'q') {
      hint.textContent = 'O / X 칸을 누르면 이동해요';
      hint.classList.toggle('hide', S.players.size > 14);
    } else {
      hint.classList.add('hide');
    }

    // 점수
    const me = S.players.get(S.myN);
    const score = me ? me.score : 0;
    const scoreEl = $('#s-score');
    if (String(score) !== scoreEl.textContent) {
      scoreEl.textContent = String(score);
      if (score > S.lastScore) {
        scoreEl.classList.remove('bump');
        void scoreEl.offsetWidth;
        scoreEl.classList.add('bump');
      }
      S.lastScore = score;
    }
    $('#s-count').textContent = S.players.size + '명';

    // 정답 공개 카드 (바뀔 때만 다시 그림)
    const card = $('#s-reveal');
    if (S.phase === 'r' && S.answer) {
      const mySide = sideOf(S.me.u);
      const ok = mySide === S.answer;
      const sig = S.answer + '|' + (mySide || '-');
      if (S.revealSig !== sig) {
        S.revealSig = sig;
        card.hidden = false;
        card.innerHTML = '';
        const b = document.createElement('div');
        b.className = 'big-ans ' + (S.answer === 'O' ? 'o' : 'x');
        b.textContent = '정답은 ' + S.answer + '!';
        const res = document.createElement('div');
        res.className = 'res ' + (ok ? 'win' : 'lose');
        res.textContent = ok ? '🎉 정답! +10점' : (mySide ? '😢 아쉬워요, 다음에!' : '🤔 다음엔 꼭 골라 보자!');
        card.appendChild(b);
        card.appendChild(res);
      }
    } else {
      S.revealSig = '';
      card.hidden = true;
    }

    renderStudentArena();
  }

  function updateStudentTimer() {
    if (S.role !== 'student') return;
    const el = $('#s-timer');
    if (!el) return;
    if (S.phase !== 'q' || !S.timerDur) {
      if (!el.hidden) el.hidden = true;
      return;
    }
    let rem = S.rem - (perf() - S.remAt);
    if (rem < 0) rem = 0;
    if (rem <= 0) { el.hidden = true; return; }
    el.hidden = false;
    $('#s-timer-num').textContent = String(Math.ceil(rem / 1000));
    el.style.setProperty('--p', String(Math.max(0, Math.min(100, (rem / (S.timerDur * 1000)) * 100))));
    el.classList.toggle('urgent', rem <= 5000);
  }

  let posTimer = null;
  let posLastAt = 0;
  function sendPosNow() {
    posLastAt = now();
    if (S.conn && S.conn.open) {
      try { S.conn.send({ t: 'pos', u: Math.round(S.me.u * 1000) / 1000, v: Math.round(S.me.v * 1000) / 1000 }); } catch (e) {}
    }
  }
  function queuePos() {
    const t = now();
    if (t - posLastAt > 55) { sendPosNow(); return; }
    if (!posTimer) {
      posTimer = setTimeout(function () { posTimer = null; sendPosNow(); }, 60);
    }
  }

  function moveMe(u, v) {
    if (S.role !== 'student') return;
    S.me.u = clamp(u, 0.02, 0.98);
    S.me.v = clamp(v, 0.05, 0.95);
    renderStudentArena();
    queuePos();
  }

  function studentLost() {
    toast('선생님과의 연결이 끊겼어요. 다시 입장해 주세요.', 4000);
    leaveStudent(false);
  }

  function leaveStudent(hard) {
    clearTimeout(S.joinTimer);
    S.joined = false;
    try { if (S.conn) S.conn.close(); } catch (e) {}
    try { if (S.peer) S.peer.destroy(); } catch (e) {}
    S.peer = null;
    S.conn = null;
    S.role = null;
    S.players = new Map();
    S.myN = null;
    S.phase = 'lobby';
    setJoinBusy(false);
    setJoinStatus(hard ? '' : '', false);
    show('join');
    const codeEl = $('#join-code');
    if (codeEl) codeEl.value = S.code || codeEl.value;
  }

  /* ═══════════════════════════════════════════
     문제 편집 / 이벤트
     ═══════════════════════════════════════════ */
  function setEditAnswer(ans) {
    S.editAnswer = ans === 'X' ? 'X' : 'O';
    $$('#qf-answer button').forEach(function (b) {
      const on = b.dataset.ans === S.editAnswer;
      b.classList.toggle('on', on);
      b.classList.toggle('on-o', on && S.editAnswer === 'O');
      b.classList.toggle('on-x', on && S.editAnswer === 'X');
    });
  }

  function openQEdit(idx) {
    S.editIndex = (typeof idx === 'number') ? idx : null;
    const q = S.editIndex === null ? { text: '', answer: 'O' } : S.questions[S.editIndex];
    $('#qedit-title').textContent = S.editIndex === null ? '문제 추가' : '문제 수정';
    $('#qf-text').value = q ? q.text : '';
    setEditAnswer(q ? q.answer : 'O');
    openModal('modal-qedit');
    setTimeout(function () { try { $('#qf-text').focus(); } catch (e) {} }, 60);
  }

  /* ── 캐릭터 고르기 (미리보기 + 4개 탭 × 5개 칩) ── */
  const AV_VIEW_FOR_TAB = { expr: 'head', hair: 'head', body: 'body', style: 'torso' };

  function loadSavedAvatar() {
    try {
      const raw = localStorage.getItem(LS_AVATAR);
      if (raw) {
        const v = JSON.parse(raw);
        if (v && typeof v === 'object') return normalizeAvatar(v);
      }
    } catch (e) {}
    return randomAvatar();
  }
  function saveAvatar(a) {
    try { localStorage.setItem(LS_AVATAR, JSON.stringify(normalizeAvatar(a))); } catch (e) {}
  }

  function avSummary(a) {
    return AV_LABEL[a.expr] + ' · ' + AV_LABEL[a.hair] + ' · ' + AV_LABEL[a.body] + ' · ' + AV_LABEL[a.style];
  }

  function renderAvPreview() {
    const box = $('#av-preview');
    if (!box) return;
    const key = avatarKey(S.pickAv);
    if (box.dataset.avk === key) return;
    box.dataset.avk = key;
    box.innerHTML = avatarMarkup(S.pickAv);
    const nm = $('#av-name');
    if (nm) nm.textContent = avSummary(normalizeAvatar(S.pickAv));
  }

  function renderAvTabs() {
    $$('#av-tabs .av-tab').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tab === S.avTab);
      b.setAttribute('aria-selected', b.dataset.tab === S.avTab ? 'true' : 'false');
    });
  }

  function renderAvOpts() {
    const box = $('#av-opts');
    if (!box) return;
    const key = S.avTab;
    const view = AV_VIEW_FOR_TAB[key] || 'full';
    const cur = normalizeAvatar(S.pickAv);
    box.innerHTML = AV_PART[key].map(function (v) {
      const trial = Object.assign({}, cur);
      trial[key] = v;
      const on = cur[key] === v;
      return '<button type="button" class="av-opt' + (on ? ' on' : '') + '" data-v="' + v + '" role="radio" aria-checked="' + on + '">' +
        '<span class="av-thumb">' + avSVG(trial, { view: view }) + '</span>' +
        '<span class="av-opt-label">' + AV_LABEL[v] + '</span></button>';
    }).join('');
  }

  function setAvPart(v) {
    const cur = normalizeAvatar(S.pickAv);
    if (cur[S.avTab] === v) return;
    cur[S.avTab] = v;
    S.pickAv = cur;
    saveAvatar(S.pickAv);
    renderAvPreview();
    renderAvOpts();
  }

  function buildAvatarPicker() {
    S.pickAv = loadSavedAvatar();
    S.avTab = 'expr';
    renderAvPreview();
    renderAvTabs();
    renderAvOpts();

    const nameEl = $('#join-name');
    try {
      const nk = localStorage.getItem(LS_NICK);
      if (nk && nameEl) nameEl.value = nk;
    } catch (e) {}
  }

  function bindEvents() {
    /* 랜딩 */
    $('#btn-role-host').addEventListener('click', function () { startHost(''); });
    $('#btn-role-student').addEventListener('click', function () {
      show('join');
      setTimeout(function () { $('#join-name').focus(); }, 150);
    });
    $('#btn-join-back').addEventListener('click', function () {
      show('landing');
      history.replaceState(null, '', location.pathname);
    });

    /* 캐릭터 고르기 */
    $('#av-tabs').addEventListener('click', function (e) {
      const b = e.target.closest('.av-tab');
      if (!b || b.dataset.tab === S.avTab) return;
      S.avTab = b.dataset.tab;
      renderAvTabs();
      renderAvOpts();
    });
    $('#av-opts').addEventListener('click', function (e) {
      const b = e.target.closest('.av-opt');
      if (!b) return;
      setAvPart(b.dataset.v);
    });
    $('#btn-av-random').addEventListener('click', function () {
      S.pickAv = randomAvatar();
      saveAvatar(S.pickAv);
      renderAvPreview();
      renderAvOpts();
    });

    /* 학생 입장 */
    $('#join-code').addEventListener('input', function (e) {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    });
    $('#join-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const code = $('#join-code').value.trim().toUpperCase();
      const name = sanitizeName($('#join-name').value);
      if (code.length < 4) { setJoinStatus('방 코드를 정확히 입력해 주세요.', true); return; }
      $('#join-name').value = name;
      try { localStorage.setItem(LS_NICK, name); } catch (er) {}
      startStudent(code, name, normalizeAvatar(S.pickAv));
    });

    /* 학생 무대 터치/클릭 */
    stuArena.root.addEventListener('pointerdown', function (e) {
      if (S.role !== 'student' || S.phase === 'r') return;
      const uv = stuArena.toUV(e.clientX, e.clientY);
      moveMe(uv.u, uv.v);
    });

    /* 키보드 */
    document.addEventListener('keydown', function (e) {
      if (S.role !== 'student' || S.phase === 'r') return;
      const key = e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(key) < 0) return;
      e.preventDefault();
      const v = stuArena.isVertical();
      const step = 0.07;
      let u = S.me.u;
      let vv = S.me.v;
      if (key === 'ArrowLeft') { if (v) vv -= step; else u -= step; }
      if (key === 'ArrowRight') { if (v) vv += step; else u += step; }
      if (key === 'ArrowUp') { if (v) u -= step; else vv -= step; }
      if (key === 'ArrowDown') { if (v) u += step; else vv += step; }
      moveMe(u, vv);
    });

    /* 방장 버튼 */
    $('#btn-copy').addEventListener('click', copyLink);
    $('#btn-copy2').addEventListener('click', copyLink);

    $('#h-timer-seg').addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b) return;
      S.timerSel = Number(b.dataset.sec) || 0;
      $$('#h-timer-seg button').forEach(function (x) { x.classList.toggle('on', x === b); });
    });

    $('#btn-ask').addEventListener('click', askQuestion);
    $('#btn-reveal').addEventListener('click', revealAnswer);
    $('#btn-next').addEventListener('click', nextQuestion);
    $('#btn-reset').addEventListener('click', function () {
      resetPositions();
      broadcast(tickMsg());
      S.lastSend = now();
      S.dirty = false;
      renderHost();
      toast('모두 가운데로 모였어요.');
    });
    $('#btn-rank').addEventListener('click', function () { renderRank(); openModal('modal-rank'); });
    $('#btn-add-q').addEventListener('click', function () { openQEdit(null); });

    $('#h-qlist').addEventListener('click', function (e) {
      const del = e.target.closest('.q-del');
      const edit = e.target.closest('.q-edit');
      const pick = e.target.closest('.q-pick');
      if (del) {
        const i = Number(del.dataset.i);
        if (!window.confirm('이 문제를 삭제할까요?')) return;
        S.questions.splice(i, 1);
        if (S.qi >= S.questions.length) S.qi = Math.max(0, S.questions.length - 1);
        saveQuestions();
        renderHost();
        return;
      }
      if (edit) { openQEdit(Number(edit.dataset.i)); return; }
      if (pick) {
        if (S.phase !== 'lobby') { toast('지금은 문제를 바꿀 수 없어요.'); return; }
        S.qi = Number(pick.dataset.i);
        renderHost();
      }
    });

    $('#qedit-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const text = $('#qf-text').value.replace(/\s+/g, ' ').trim().slice(0, 140);
      if (!text) { toast('문제 내용을 입력해 주세요.'); return; }
      if (S.editIndex === null || S.editIndex === undefined) {
        S.questions.push({ text: text, answer: S.editAnswer });
        S.qi = S.questions.length - 1;
      } else {
        S.questions[S.editIndex] = { text: text, answer: S.editAnswer };
      }
      saveQuestions();
      closeModal('modal-qedit');
      renderHost();
      toast('저장했어요 ✏️');
    });

    $('#qf-answer').addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b) return;
      setEditAnswer(b.dataset.ans);
    });

    $$('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { closeModal(b.dataset.close); });
    });
    $$('.modal').forEach(function (m) {
      m.addEventListener('click', function (e) { if (e.target === m) m.hidden = true; });
    });

    $('#btn-leave').addEventListener('click', function () {
      if (!window.confirm('방을 닫을까요? 학생들의 연결이 모두 끊어져요.')) return;
      try { broadcast({ t: 'bye' }); } catch (e) {}
      S.role = null;
      try { sessionStorage.removeItem(SS_ROOM); } catch (e) {}
      setTimeout(function () {
        try { if (S.peer) S.peer.destroy(); } catch (e) {}
        location.href = location.pathname;
      }, 250);
    });

    /* 창 크기 변경 */
    let resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        hostArena.redraw();
        stuArena.redraw();
      }, 120);
    });
  }

  /* ═══════════════════════════════════════════
     시작
     ═══════════════════════════════════════════ */
  function init() {
    S.questions = loadQuestions();
    buildAvatarPicker();
    bindEvents();

    setInterval(hostLoop, 100);
    setInterval(updateStudentTimer, 100);

    const params = new URLSearchParams(location.search);
    const room = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (room) {
      show('join');
      $('#join-code').value = room;
      setTimeout(function () { try { $('#join-name').focus(); } catch (e) {} }, 220);
    } else {
      show('landing');
    }
  }

  window.addEventListener('error', function (e) {
    const f = document.getElementById('fatal');
    if (!f) return;
    f.hidden = false;
    f.textContent = '오류가 발생했어요: ' + (e.message || '알 수 없는 오류');
    setTimeout(function () { f.hidden = true; }, 8000);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
