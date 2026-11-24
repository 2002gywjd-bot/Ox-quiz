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
   전신 사람 캐릭터 — 표정 8 · 머리 12 · 체형 6 · 스타일 8
   머리 → 목 → 상의 → 하의 → 신발(발)까지 나오는 2~2.5등신.
   성별을 고정하지 않는 중성적인 톤으로 그린다.
   같은 조합이면 언제나 같은 SVG가 나오므로, 선생님 화면·학생 화면·
   순위표에서 똑같은 캐릭터가 그려진다.
   ══════════════════════════════════════════════════════════ */
const AV_PART = {
  expr: ['smile', 'grin', 'wink', 'focus', 'wow', 'tongue', 'pout', 'star'],
  hair: ['mohawk', 'dread', 'perm', 'twoblock', 'part', 'pomade', 'buzz', 'spiky', 'wolf', 'bob', 'bun', 'wave'],
  body: ['petite', 'slim', 'normal', 'sturdy', 'round', 'tall'],
  style: ['hoodie', 'shirtvest', 'overalls', 'varsity', 'jersey', 'cardigan', 'stripe', 'anorak']
};

const AV_TABS = [
  { key: 'expr', name: '표정', icon: '😊' },
  { key: 'hair', name: '머리', icon: '💇' },
  { key: 'body', name: '체형', icon: '🧍' },
  { key: 'style', name: '스타일', icon: '👕' }
];

const AV_LABEL = {
  smile: '미소', grin: '활짝', wink: '윙크', focus: '진지',
  wow: '놀람', tongue: '메롱', pout: '삐죽', star: '반짝',
  mohawk: '모히칸', dread: '레게머리', perm: '파마', twoblock: '투블럭',
  part: '가르마', pomade: '포마드', buzz: '반삭', spiky: '삐죽',
  wolf: '울프컷', bob: '단발', bun: '묶음', wave: '웨이브',
  short: '숏컷', curly: '곱슬', pony: '포니테일',
  petite: '아담', slim: '슬림', normal: '보통',
  sturdy: '듬직', round: '통통', tall: '키다리',
  hoodie: '후드+조거', shirtvest: '셔츠+베스트', overalls: '멜빵데님', varsity: '야구점퍼',
  jersey: '트레이닝', cardigan: '가디건+치노', stripe: '스트라이프', anorak: '아노락'
};

const AV_DEFAULT = { expr: 'smile', hair: 'twoblock', body: 'normal', style: 'hoodie' };

/* 체형 — 머리 반지름(r) · 머리 중심(headCy) · 어깨(shw) · 허리(wst) · 엉덩이(hipw)
   · 상의 밑단(hemY) · 팔 두께(armW) · 목 두께(neck) */
const AV_BODY = {
  petite: { r: 25.0, headCy: 46, shw: 11.5, wst: 9.0, hipw: 11.0, hemY: 106, armW: 6.8, neck: 5.0 },
  slim:   { r: 26.0, headCy: 42, shw: 11.5, wst: 9.0, hipw: 11.2, hemY: 110, armW: 6.4, neck: 4.9 },
  normal: { r: 28.5, headCy: 39, shw: 15.5, wst: 12.5, hipw: 14.5, hemY: 112, armW: 8.0, neck: 6.0 },
  sturdy: { r: 28.0, headCy: 39, shw: 20.5, wst: 16.5, hipw: 18.0, hemY: 113, armW: 9.2, neck: 7.2 },
  round:  { r: 29.5, headCy: 41, shw: 19.0, wst: 18.5, hipw: 19.5, hemY: 114, armW: 9.4, neck: 6.4 },
  tall:   { r: 26.5, headCy: 36, shw: 14.5, wst: 11.5, hipw: 13.0, hemY: 118, armW: 7.4, neck: 5.2 }
};

/* 머리카락 색 — 자연스러운 블랙·다크브라운·애쉬 계열 */
const AV_HAIR_COLOR = {
  mohawk: '#2e2a34',
  dread: '#3b2f28',
  perm: '#5a4433',
  twoblock: '#322d3a',
  part: '#3f3229',
  pomade: '#2b2731',
  buzz: '#3a3540',
  spiky: '#3a3340',
  wolf: '#2f2b33',
  bob: '#4a3b2f',
  bun: '#3d3140',
  wave: '#5a4636'
};

/* 예전에 저장된 머리 키도 새 스타일로 이어 준다 (오류 없이 매핑) */
const AV_HAIR_ALIAS = {
  short: 'twoblock', crop: 'twoblock', dandy: 'twoblock', twoblockcut: 'twoblock', two: 'twoblock',
  curly: 'perm', afro: 'perm', volume: 'perm', pama: 'perm',
  pony: 'bun', ponytail: 'bun', lowbun: 'bun', braid: 'bun', updo: 'bun',
  slick: 'pomade', slickback: 'pomade', allback: 'pomade', back: 'pomade',
  fade: 'buzz', crew: 'buzz', crewcut: 'buzz', buzzcut: 'buzz', shaved: 'buzz',
  mohican: 'mohawk', mohegan: 'mohawk',
  dreads: 'dread', dreadlock: 'dread', dreadlocks: 'dread', reggae: 'dread', wig: 'dread',
  side: 'part', sidepart: 'part', '6:4': 'part', combover: 'part',
  spike: 'spiky', spikes: 'spiky',
  long: 'wave', layered: 'wolf', layer: 'wolf'
};

/* 스타일 — 상의 + 하의 + 신발 세트 코디 */
const AV_STYLE = {
  hoodie: {
    main: '#6ec9f2', dark: '#2f9fd0', light: '#e3f6fe', accent: '#ffffff',
    sleeve: '#6ec9f2', bottom: 'jogger', pants: '#425f8f', pantsDark: '#2f466b',
    shoe: '#ffffff', sole: '#c7d2e0', sock: '#ffffff'
  },
  shirtvest: {
    main: '#7d8fb3', dark: '#3f4d6b', light: '#fbfcff', accent: '#ffd45c',
    sleeve: '#fbfcff', bottom: 'slacks', pants: '#454f66', pantsDark: '#333b4f',
    shoe: '#3c3c46', sole: '#9aa0ad', sock: '#3c3c46'
  },
  overalls: {
    main: '#eef6ff', dark: '#3a63a8', light: '#eef6ff', accent: '#ffd45c',
    sleeve: '#eef6ff', bottom: 'denim', pants: '#5b8fd6', pantsDark: '#3a63a8',
    shoe: '#f6e7c8', sole: '#d3bb92', sock: '#ffffff'
  },
  varsity: {
    main: '#f7f7fb', dark: '#cfd6e6', light: '#ffffff', accent: '#e0556f',
    sleeve: '#e0556f', bottom: 'straight', pants: '#3d4a63', pantsDark: '#2c374b',
    shoe: '#2f3a4d', sole: '#9aa4b8', sock: '#2f3a4d'
  },
  jersey: {
    main: '#4ecb8d', dark: '#2a9d68', light: '#e9fbf2', accent: '#ffffff',
    sleeve: '#2a9d68', bottom: 'track', pants: '#2f3f57', pantsDark: '#22304a',
    shoe: '#20c7b0', sole: '#0f9488', sock: '#ffffff'
  },
  cardigan: {
    main: '#c9b6f5', dark: '#7c5fd3', light: '#fbf8ff', accent: '#ffd98a',
    sleeve: '#c9b6f5', bottom: 'chino', pants: '#d9c6a6', pantsDark: '#bda87f',
    shoe: '#6b5540', sole: '#3f3323', sock: '#6b5540'
  },
  stripe: {
    main: '#ffd166', dark: '#e0a93b', light: '#fff8e6', accent: '#ef6f6c',
    sleeve: '#ffd166', bottom: 'shorts', pants: '#4f6d9a', pantsDark: '#3c5480',
    shoe: '#ffffff', sole: '#c3cbdb', sock: '#ffffff'
  },
  anorak: {
    main: '#a3b8ff', dark: '#5468d4', light: '#eef1ff', accent: '#ffffff',
    sleeve: '#a3b8ff', bottom: 'track', pants: '#8b93c9', pantsDark: '#6f77b0',
    shoe: '#3f4bb0', sole: '#c7cdea', sock: '#ffffff'
  }
};

const AV_SKIN = '#ffd9c0';
const AV_SKIN2 = '#f0b995';
const AV_SKIN3 = '#e0a07f';
const AV_INK = '#3b2c3a';
const AV_GROUND = 149;          /* 발바닥이 닿는 선 */
const AV_VIEWBOX = '0 -9.5 100 167.5';   /* 솟은 머리(모히칸·스파이크)까지 잘리지 않게 위를 넓힌다 */

let AV_UID = 0;

function avn(v) { return Math.round(v * 10) / 10; }

function avPick(list, v, fallback) {
  return list.indexOf(v) >= 0 ? v : fallback;
}

function avHairPick(v) {
  if (AV_PART.hair.indexOf(v) >= 0) return v;
  const k = String(v == null ? '' : v).toLowerCase().replace(/[\s_-]/g, '');
  const al = AV_HAIR_ALIAS[k];
  return al && AV_PART.hair.indexOf(al) >= 0 ? al : AV_DEFAULT.hair;
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
      hair: avHairPick(v.hair),
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

/* ─────────── 몸 좌표 ───────────
   발바닥(AV_GROUND)을 고정하고, 체형마다 머리 크기와 비율만 바꾼다. */
function avM(bodyKey) {
  const b = AV_BODY[bodyKey] || AV_BODY.normal;
  const r = b.r;
  const cy = b.headCy;
  const chin = cy + r * 1.02;
  const shoulderY = chin + 6.5;
  const hemY = b.hemY;
  const hipY = hemY - 1;
  const kneeY = hipY + (AV_GROUND - hipY) * 0.5;
  const ankleY = AV_GROUND - 5.5;
  const midY = shoulderY + (hemY - shoulderY) * 0.55;
  return {
    b: b, r: r, cy: cy, chin: chin,
    shoulderY: shoulderY, hemY: hemY, hipY: hipY, kneeY: kneeY,
    ankleY: ankleY, soleY: AV_GROUND, midY: midY,
    shw: b.shw, wst: b.wst, hipw: b.hipw, nw: b.neck, armW: b.armW,
    legW: b.hipw * 0.42, legX: b.hipw * 0.45 + 0.4,
    armY: shoulderY + (hemY - shoulderY) * 0.80,
    armX: b.shw + 2.4
  };
}

/* ─────────── 목 (옷보다 먼저 그려서 옷이 목 아래를 덮는다) ─────────── */
function avNeck(m) {
  const topY = m.cy + m.r * 0.40;
  const w = m.nw;
  const h = m.shoulderY + 6 - topY;
  let s = '<rect x="' + avn(50 - w) + '" y="' + avn(topY) + '" width="' + avn(w * 2) +
    '" height="' + avn(h) + '" rx="' + avn(w * 0.72) + '" fill="' + AV_SKIN2 + '"/>';
  /* 턱 밑 옅은 그늘 */
  s += '<ellipse cx="50" cy="' + avn(topY + 1.2) + '" rx="' + avn(w * 0.94) + '" ry="' + avn(1.6) +
    '" fill="' + AV_SKIN3 + '" opacity=".55"/>';
  return s;
}

function avEars(m) {
  const rr = avn(m.r * 0.155);
  return '<circle cx="' + avn(50 - m.r * 0.99) + '" cy="' + avn(m.cy + m.r * 0.14) + '" r="' + rr + '" fill="' + AV_SKIN2 + '"/>' +
    '<circle cx="' + avn(50 + m.r * 0.99) + '" cy="' + avn(m.cy + m.r * 0.14) + '" r="' + rr + '" fill="' + AV_SKIN2 + '"/>';
}

/* ─────────── 상의 몸통 ─────────── */
function avTorsoPath(m) {
  const shw = m.shw, wst = m.wst, hipw = m.hipw, sy = m.shoulderY, my = m.midY, hem = m.hemY;
  const L = 50 - shw, R = 50 + shw;
  const wL = 50 - wst, wR = 50 + wst;
  const hL = 50 - hipw, hR = 50 + hipw;
  return 'M' + avn(L) + ' ' + avn(sy + 2.5) +
    ' C' + avn(L - 1.8) + ' ' + avn(sy + (my - sy) * 0.5) + ' ' + avn(wL - 0.6) + ' ' + avn(my - 7) + ' ' + avn(wL) + ' ' + avn(my) +
    ' C' + avn(wL + 0.4) + ' ' + avn(my + 7) + ' ' + avn(hL + 1.4) + ' ' + avn(hem - 7) + ' ' + avn(hL) + ' ' + avn(hem) +
    ' L' + avn(hR) + ' ' + avn(hem) +
    ' C' + avn(hR - 1.4) + ' ' + avn(hem - 7) + ' ' + avn(wR - 0.4) + ' ' + avn(my + 7) + ' ' + avn(wR) + ' ' + avn(my) +
    ' C' + avn(wR + 0.6) + ' ' + avn(my - 7) + ' ' + avn(R + 1.8) + ' ' + avn(sy + (my - sy) * 0.5) + ' ' + avn(R) + ' ' + avn(sy + 2.5) +
    ' Q50 ' + avn(sy - 3) + ' ' + avn(L) + ' ' + avn(sy + 2.5) + ' Z';
}

/* ─────────── 다리 · 바지 ─────────── */
function avLegShape(cx, w, topY, botY, taper) {
  const tw = w * (taper || 0.95);
  const span = botY - topY;
  return 'M' + avn(cx - w) + ' ' + avn(topY) +
    ' L' + avn(cx + w) + ' ' + avn(topY) +
    ' C' + avn(cx + w) + ' ' + avn(topY + span * 0.5) + ' ' + avn(cx + tw) + ' ' + avn(botY - 4) + ' ' + avn(cx + tw) + ' ' + avn(botY) +
    ' L' + avn(cx - tw) + ' ' + avn(botY) +
    ' C' + avn(cx - tw) + ' ' + avn(botY - 4) + ' ' + avn(cx - w) + ' ' + avn(topY + span * 0.5) + ' ' + avn(cx - w) + ' ' + avn(topY) + ' Z';
}

/* ─────────── 신발 ─────────── */
function avShoe(cx, legW, ankleY, soleY, pal) {
  const w = legW * 1.24;
  const shoe2 = avShade(pal.shoe, 0.86);
  const body = 'M' + avn(cx - w) + ' ' + avn(ankleY) +
    ' L' + avn(cx + w) + ' ' + avn(ankleY) +
    ' Q' + avn(cx + w + 1.7) + ' ' + avn(ankleY + 1.4) + ' ' + avn(cx + w + 1.5) + ' ' + avn(soleY - 2.6) +
    ' Q' + avn(cx + w + 1.3) + ' ' + avn(soleY) + ' ' + avn(cx + w - 2.2) + ' ' + avn(soleY) +
    ' L' + avn(cx - w + 2.2) + ' ' + avn(soleY) +
    ' Q' + avn(cx - w - 1.3) + ' ' + avn(soleY) + ' ' + avn(cx - w - 1.5) + ' ' + avn(soleY - 2.6) +
    ' Q' + avn(cx - w - 1.7) + ' ' + avn(ankleY + 1.4) + ' ' + avn(cx - w) + ' ' + avn(ankleY) + ' Z';
  const sole = 'M' + avn(cx - w - 1.3) + ' ' + avn(soleY - 2.6) +
    ' L' + avn(cx + w + 1.3) + ' ' + avn(soleY - 2.6) +
    ' L' + avn(cx + w + 1.3) + ' ' + avn(soleY - 1.2) +
    ' Q' + avn(cx + w + 1.3) + ' ' + avn(soleY) + ' ' + avn(cx + w - 2.2) + ' ' + avn(soleY) +
    ' L' + avn(cx - w + 2.2) + ' ' + avn(soleY) +
    ' Q' + avn(cx - w - 1.3) + ' ' + avn(soleY) + ' ' + avn(cx - w - 1.3) + ' ' + avn(soleY - 1.2) + ' Z';
  let s = '<path d="' + body + '" fill="' + pal.shoe + '"/>';
  s += '<path d="' + sole + '" fill="' + pal.sole + '"/>';
  s += '<path d="M' + avn(cx - w + 0.6) + ' ' + avn(ankleY + 4.4) +
    ' Q' + avn(cx) + ' ' + avn(ankleY + 6.2) + ' ' + avn(cx + w - 0.6) + ' ' + avn(ankleY + 4.4) +
    '" stroke="' + shoe2 + '" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".85"/>';
  return s;
}

function avBottoms(m, pal) {
  const kind = pal.bottom || 'straight';
  const topY = m.hemY - 7;
  let s = '';

  /* 반바지 — 맨다리를 먼저 깐다 */
  if (kind === 'shorts') {
    [1, -1].forEach(function (sd) {
      s += '<path d="' + avLegShape(50 + sd * m.legX, m.legW * 0.80, m.hemY - 6, m.ankleY + 1, 0.88) +
        '" fill="' + AV_SKIN + '"/>';
    });
  }

  const endY = kind === 'shorts' ? m.kneeY + 5 : m.ankleY;
  const taper = kind === 'jogger' ? 0.86 : kind === 'track' ? 0.92 : 0.95;
  [1, -1].forEach(function (sd) {
    s += '<path d="' + avLegShape(50 + sd * m.legX, m.legW, topY, endY, taper) + '" fill="' + pal.pants + '"/>';
  });

  /* 바지 디테일 */
  [1, -1].forEach(function (sd) {
    const x = 50 + sd * m.legX;
    const outer = x + sd * m.legW;
    if (kind === 'jogger') {
      s += '<rect x="' + avn(x - m.legW * 0.87) + '" y="' + avn(endY - 4.2) + '" width="' + avn(m.legW * 1.74) +
        '" height="4.2" rx="1.4" fill="' + pal.pantsDark + '"/>';
    } else if (kind === 'track') {
      s += '<path d="M' + avn(outer - sd * 0.8) + ' ' + avn(topY + 3) + ' L' + avn(x + sd * m.legW * 0.95) + ' ' + avn(endY - 2) +
        '" stroke="' + pal.accent + '" stroke-width="1.8" opacity=".9"/>';
    } else if (kind === 'denim') {
      s += '<path d="M' + avn(x) + ' ' + avn(topY + 2) + ' L' + avn(x) + ' ' + avn(endY - 4.5) +
        '" stroke="' + pal.light + '" stroke-width="1.1" opacity=".5" stroke-dasharray="2 2"/>';
      s += '<rect x="' + avn(x - m.legW * 0.98) + '" y="' + avn(endY - 4.6) + '" width="' + avn(m.legW * 1.96) +
        '" height="4.6" rx="1.2" fill="' + pal.light + '" opacity=".6"/>';
    } else if (kind === 'slacks') {
      s += '<path d="M' + avn(x) + ' ' + avn(topY + 4) + ' L' + avn(x) + ' ' + avn(endY - 3) +
        '" stroke="' + pal.pantsDark + '" stroke-width="1" opacity=".45"/>';
    } else if (kind === 'chino') {
      s += '<rect x="' + avn(x - m.legW * 0.92) + '" y="' + avn(endY - 3.6) + '" width="' + avn(m.legW * 1.84) +
        '" height="3.6" rx="1.2" fill="' + pal.pantsDark + '" opacity=".5"/>';
    } else if (kind === 'shorts') {
      s += '<rect x="' + avn(x - m.legW * 1.02) + '" y="' + avn(endY - 3.8) + '" width="' + avn(m.legW * 2.04) +
        '" height="3.8" rx="1.2" fill="' + pal.pantsDark + '" opacity=".5"/>';
    }
  });

  /* 반바지 양말 */
  if (kind === 'shorts') {
    [1, -1].forEach(function (sd) {
      const x = 50 + sd * m.legX;
      s += '<rect x="' + avn(x - m.legW * 0.84) + '" y="' + avn(m.ankleY - 7) + '" width="' + avn(m.legW * 1.68) +
        '" height="7.4" rx="2.6" fill="' + pal.sock + '"/>';
      s += '<rect x="' + avn(x - m.legW * 0.84) + '" y="' + avn(m.ankleY - 7) + '" width="' + avn(m.legW * 1.68) +
        '" height="2" rx="1" fill="' + pal.accent + '" opacity=".85"/>';
    });
  }

  /* 신발 */
  [1, -1].forEach(function (sd) {
    s += avShoe(50 + sd * m.legX, m.legW, m.ankleY, m.soleY, pal);
  });
  return s;
}

/* ─────────── 소매(팔) · 손 ─────────── */
function avArms(m, pal) {
  let s = '';
  const line = avShade(pal.sleeve, 0.72);
  [1, -1].forEach(function (sd) {
    const sx = 50 + sd * (m.shw - 1.0);
    const hx = 50 + sd * m.armX;
    const mx = 50 + sd * (m.shw + 1.2);
    const d = 'M' + avn(sx) + ' ' + avn(m.shoulderY + 3.5) +
      ' Q' + avn(mx) + ' ' + avn(m.shoulderY + (m.armY - m.shoulderY) * 0.55) + ' ' + avn(hx) + ' ' + avn(m.armY);
    s += '<path d="' + d + '" fill="none" stroke="' + line + '" stroke-width="' + avn(m.armW + 1.6) + '" stroke-linecap="round" opacity=".55"/>';
    s += '<path d="' + d + '" fill="none" stroke="' + pal.sleeve + '" stroke-width="' + avn(m.armW) + '" stroke-linecap="round"/>';
  });
  return s;
}

function avHands(m) {
  const rr = avn(m.armW * 0.46);
  return '<circle cx="' + avn(50 - m.armX) + '" cy="' + avn(m.armY) + '" r="' + rr + '" fill="' + AV_SKIN + '"/>' +
    '<circle cx="' + avn(50 + m.armX) + '" cy="' + avn(m.armY) + '" r="' + rr + '" fill="' + AV_SKIN + '"/>';
}

/* ─────────── 옷 뒤에 깔리는 것 (후드) ─────────── */
function avStyleBehind(style, m, pal) {
  if (style !== 'hoodie' && style !== 'anorak') return '';
  const big = style === 'hoodie' ? 1 : 0.82;
  const L = 50 - m.shw - 2 * big;
  const R = 50 + m.shw + 2 * big;
  const top = m.shoulderY - 9 * big;
  const sy = m.shoulderY;
  return '<path d="M' + avn(L) + ' ' + avn(sy + 2) +
    ' C' + avn(L - 1.4) + ' ' + avn(sy - 5 * big) + ' ' + avn(50 - m.shw * 0.45) + ' ' + avn(top) + ' 50 ' + avn(top) +
    ' C' + avn(50 + m.shw * 0.45) + ' ' + avn(top) + ' ' + avn(R + 1.4) + ' ' + avn(sy - 5 * big) + ' ' + avn(R) + ' ' + avn(sy + 2) +
    ' Z" fill="' + pal.dark + '"/>';
}

/* ─────────── 스타일별 상의 디테일 ─────────── */
function avStyleFront(style, m, pal, torsoD, uid) {
  const cx = 50, sy = m.shoulderY, my = m.midY, hem = m.hemY, hipw = m.hipw, shw = m.shw, nw = m.nw;
  let s = '';

  if (style === 'hoodie') {
    s += '<rect x="' + avn(cx - 11.5) + '" y="' + avn(hem - 20) + '" width="23" height="11" rx="4.5" fill="' + pal.dark + '" opacity=".45"/>';
    s += '<rect x="' + avn(cx - hipw + 1.4) + '" y="' + avn(hem - 4.8) + '" width="' + avn(hipw * 2 - 2.8) +
      '" height="4.8" rx="1.8" fill="' + pal.dark + '" opacity=".55"/>';
    s += '<path d="M' + avn(cx - 3.6) + ' ' + avn(sy + 4) + ' L' + avn(cx - 4.2) + ' ' + avn(sy + 16) +
      '" stroke="' + pal.light + '" stroke-width="1.9" stroke-linecap="round"/>';
    s += '<path d="M' + avn(cx + 3.6) + ' ' + avn(sy + 4) + ' L' + avn(cx + 4.2) + ' ' + avn(sy + 15) +
      '" stroke="' + pal.light + '" stroke-width="1.9" stroke-linecap="round"/>';
    s += '<circle cx="' + avn(cx - 4.3) + '" cy="' + avn(sy + 17) + '" r="1.6" fill="' + pal.light + '"/>';
    s += '<circle cx="' + avn(cx + 4.3) + '" cy="' + avn(sy + 16) + '" r="1.6" fill="' + pal.light + '"/>';

  } else if (style === 'shirtvest') {
    const vy = sy + 16;
    s += '<path d="M' + avn(cx - nw - 4.5) + ' ' + avn(sy - 2) + ' L' + avn(cx) + ' ' + avn(vy) +
      ' L' + avn(cx + nw + 4.5) + ' ' + avn(sy - 2) + ' Z" fill="' + pal.light + '"/>';
    s += '<path d="M' + avn(cx - nw - 4.5) + ' ' + avn(sy - 2) + ' L' + avn(cx) + ' ' + avn(vy + 2) +
      ' L' + avn(cx + nw + 4.5) + ' ' + avn(sy - 2) + '" fill="none" stroke="' + pal.dark +
      '" stroke-width="2.4" stroke-linejoin="round" opacity=".9"/>';
    s += '<circle cx="' + avn(cx) + '" cy="' + avn(vy + 8) + '" r="1.7" fill="' + pal.accent + '"/>';
    s += '<circle cx="' + avn(cx) + '" cy="' + avn(vy + 16) + '" r="1.7" fill="' + pal.accent + '"/>';
    s += '<path d="M' + avn(cx - hipw + 1) + ' ' + avn(hem - 3.4) + ' Q' + avn(cx) + ' ' + avn(hem + 0.4) + ' ' + avn(cx + hipw - 1) + ' ' + avn(hem - 3.4) +
      '" stroke="' + pal.dark + '" stroke-width="1.8" fill="none" opacity=".35"/>';

  } else if (style === 'overalls') {
    const bibTop = sy + 7, bibW = 10.5;
    s += '<path d="M' + avn(cx - bibW) + ' ' + avn(bibTop) + ' L' + avn(cx + bibW) + ' ' + avn(bibTop) +
      ' L' + avn(cx + bibW - 0.6) + ' ' + avn(hem) + ' L' + avn(cx - bibW + 0.6) + ' ' + avn(hem) + ' Z" fill="' + pal.pants + '"/>';
    s += '<path d="M' + avn(cx - bibW + 0.8) + ' ' + avn(bibTop + 1) + ' L' + avn(cx - nw - 1.4) + ' ' + avn(sy - 1.5) +
      '" stroke="' + pal.pants + '" stroke-width="3.4" stroke-linecap="round"/>';
    s += '<path d="M' + avn(cx + bibW - 0.8) + ' ' + avn(bibTop + 1) + ' L' + avn(cx + nw + 1.4) + ' ' + avn(sy - 1.5) +
      '" stroke="' + pal.pants + '" stroke-width="3.4" stroke-linecap="round"/>';
    s += '<circle cx="' + avn(cx - bibW + 2.2) + '" cy="' + avn(bibTop + 3.2) + '" r="1.7" fill="' + pal.accent + '"/>';
    s += '<circle cx="' + avn(cx + bibW - 2.2) + '" cy="' + avn(bibTop + 3.2) + '" r="1.7" fill="' + pal.accent + '"/>';
    s += '<rect x="' + avn(cx - 6.4) + '" y="' + avn(bibTop + 6) + '" width="12.8" height="7.5" rx="2" fill="none" stroke="' + pal.light +
      '" stroke-width="1.3" opacity=".75"/>';
    s += '<path d="M' + avn(cx - bibW + 1.4) + ' ' + avn(bibTop + 1.4) + ' L' + avn(cx + bibW - 1.4) + ' ' + avn(bibTop + 1.4) +
      '" stroke="' + pal.light + '" stroke-width="1" stroke-dasharray="2 2" opacity=".8"/>';

  } else if (style === 'varsity') {
    s += '<rect x="' + avn(cx - hipw + 1.5) + '" y="' + avn(hem - 5) + '" width="' + avn(hipw * 2 - 3) +
      '" height="5" rx="1.6" fill="' + pal.dark + '"/>';
    s += '<rect x="' + avn(cx - hipw + 1.5) + '" y="' + avn(hem - 3.2) + '" width="' + avn(hipw * 2 - 3) +
      '" height="1.6" fill="' + pal.accent + '" opacity=".95"/>';
    s += '<path d="M' + avn(cx) + ' ' + avn(sy + 2) + ' L' + avn(cx) + ' ' + avn(hem - 5) +
      '" stroke="' + pal.dark + '" stroke-width="1.2" opacity=".55"/>';
    for (let i = 0; i < 3; i++) {
      s += '<circle cx="' + avn(cx) + '" cy="' + avn(sy + 10 + i * 8) + '" r="1.3" fill="' + pal.accent + '"/>';
    }
    s += '<circle cx="' + avn(cx - shw * 0.46) + '" cy="' + avn(sy + 11) + '" r="3.4" fill="' + pal.accent + '" opacity=".85"/>';
    s += '<path d="M' + avn(cx - shw * 0.46 - 2) + ' ' + avn(sy + 11) + ' L' + avn(cx - shw * 0.46 + 2) + ' ' + avn(sy + 11) +
      '" stroke="#ffffff" stroke-width="1.2" opacity=".9"/>';

  } else if (style === 'jersey') {
    s += '<defs><clipPath id="' + uid + 'c"><path d="' + torsoD + '"/></clipPath></defs>';
    s += '<g clip-path="url(#' + uid + 'c)">';
    s += '<path d="M' + avn(cx - shw - 2) + ' ' + avn(sy + 26) + ' L' + avn(cx + shw + 2) + ' ' + avn(sy + 14) +
      ' L' + avn(cx + shw + 2) + ' ' + avn(sy + 20) + ' L' + avn(cx - shw - 2) + ' ' + avn(sy + 32) + ' Z" fill="' + pal.light + '" opacity=".55"/>';
    s += '<path d="M' + avn(cx - shw - 2) + ' ' + avn(sy + 36) + ' L' + avn(cx + shw + 2) + ' ' + avn(sy + 24) +
      ' L' + avn(cx + shw + 2) + ' ' + avn(sy + 28) + ' L' + avn(cx - shw - 2) + ' ' + avn(sy + 40) + ' Z" fill="' + pal.accent + '" opacity=".85"/>';
    s += '</g>';
    s += '<rect x="' + avn(cx - hipw + 1.6) + '" y="' + avn(hem - 4.4) + '" width="' + avn(hipw * 2 - 3.2) +
      '" height="4.4" rx="1.4" fill="' + pal.dark + '" opacity=".8"/>';
    s += '<path d="M' + avn(cx - 3.4) + ' ' + avn(sy + 5) + ' L' + avn(cx - 3.4) + ' ' + avn(sy + 9) +
      '" stroke="' + pal.accent + '" stroke-width="2" stroke-linecap="round"/>';
    s += '<path d="M' + avn(cx + 3.4) + ' ' + avn(sy + 5) + ' L' + avn(cx + 3.4) + ' ' + avn(sy + 9) +
      '" stroke="' + pal.accent + '" stroke-width="2" stroke-linecap="round"/>';

  } else if (style === 'cardigan') {
    s += '<rect x="' + avn(cx - 4.6) + '" y="' + avn(sy + 2) + '" width="9.2" height="' + avn(hem - sy - 2) +
      '" fill="' + pal.light + '"/>';
    s += '<path d="M' + avn(cx - 4.6) + ' ' + avn(sy + 2) + ' L' + avn(cx - 4.6) + ' ' + avn(hem) +
      '" stroke="' + pal.dark + '" stroke-width="1.3" opacity=".55"/>';
    s += '<path d="M' + avn(cx + 4.6) + ' ' + avn(sy + 2) + ' L' + avn(cx + 4.6) + ' ' + avn(hem) +
      '" stroke="' + pal.dark + '" stroke-width="1.3" opacity=".55"/>';
    for (let i = 0; i < 3; i++) {
      s += '<circle cx="' + avn(cx - 2.2) + '" cy="' + avn(my - 8 + i * 10) + '" r="1.5" fill="' + pal.accent + '"/>';
    }
    s += '<rect x="' + avn(cx - hipw + 1.4) + '" y="' + avn(hem - 4.6) + '" width="' + avn(hipw * 2 - 2.8) +
      '" height="4.6" rx="1.6" fill="' + pal.dark + '" opacity=".28"/>';

  } else if (style === 'stripe') {
    s += '<defs><clipPath id="' + uid + 'c"><path d="' + torsoD + '"/></clipPath></defs>';
    s += '<g clip-path="url(#' + uid + 'c)">';
    s += '<rect x="' + avn(cx - shw - 3) + '" y="' + avn(sy + 11) + '" width="' + avn(shw * 2 + 6) + '" height="4.4" fill="' + pal.accent + '"/>';
    s += '<rect x="' + avn(cx - shw - 3) + '" y="' + avn(sy + 20) + '" width="' + avn(shw * 2 + 6) + '" height="4.4" fill="' + pal.accent + '"/>';
    s += '<rect x="' + avn(cx - shw - 3) + '" y="' + avn(sy + 29) + '" width="' + avn(shw * 2 + 6) + '" height="4.4" fill="' + pal.accent + '"/>';
    s += '</g>';
    s += '<rect x="' + avn(cx - hipw + 1.6) + '" y="' + avn(hem - 4.4) + '" width="' + avn(hipw * 2 - 3.2) +
      '" height="4.4" rx="1.4" fill="' + pal.light + '"/>';

  } else {
    /* anorak */
    s += '<path d="M' + avn(cx) + ' ' + avn(sy + 3) + ' L' + avn(cx) + ' ' + avn(sy + 17) +
      '" stroke="' + pal.dark + '" stroke-width="2.3" stroke-linecap="round"/>';
    s += '<circle cx="' + avn(cx) + '" cy="' + avn(sy + 18.5) + '" r="1.9" fill="' + pal.accent + '"/>';
    s += '<path d="M' + avn(cx - 9.5) + ' ' + avn(sy + 14) + ' L' + avn(cx - 4.2) + ' ' + avn(sy + 12.4) +
      '" stroke="' + pal.dark + '" stroke-width="1.7" stroke-linecap="round" opacity=".75"/>';
    s += '<path d="M' + avn(cx - hipw + 3) + ' ' + avn(hem - 12) + ' L' + avn(cx - 1.5) + ' ' + avn(hem - 4) +
      '" stroke="' + pal.dark + '" stroke-width="1.5" opacity=".45" stroke-linecap="round"/>';
    s += '<path d="M' + avn(cx + hipw - 3) + ' ' + avn(hem - 12) + ' L' + avn(cx + 1.5) + ' ' + avn(hem - 4) +
      '" stroke="' + pal.dark + '" stroke-width="1.5" opacity=".45" stroke-linecap="round"/>';
    s += '<rect x="' + avn(cx - hipw + 1.3) + '" y="' + avn(hem - 4.2) + '" width="' + avn(hipw * 2 - 2.6) +
      '" height="4.2" rx="1.5" fill="' + pal.dark + '" opacity=".35"/>';
  }
  return s;
}

/* ─────────── 목둘레(칼라) — 목 아래를 자연스럽게 덮는다 ─────────── */
function avCollar(style, m, pal) {
  const cx = 50;
  const y = m.shoulderY - 1;
  const w = m.nw + 3.4;
  const rim = 'M' + avn(cx - w) + ' ' + avn(y - 3) + ' Q' + avn(cx) + ' ' + avn(y + 6.5) + ' ' + avn(cx + w) + ' ' + avn(y - 3);
  const lw = avn(Math.max(2.6, m.armW * 0.42));

  if (style === 'shirtvest') {
    return '<path d="' + rim + '" stroke="' + pal.light + '" stroke-width="' + lw + '" fill="none" stroke-linecap="round"/>' +
      '<path d="M' + avn(cx - w + 0.6) + ' ' + avn(y - 3.4) + ' L' + avn(cx - 1.4) + ' ' + avn(y + 11) +
      ' L' + avn(cx - w - 1.6) + ' ' + avn(y + 4) + ' Z" fill="' + pal.light + '" stroke="' + pal.dark +
      '" stroke-width=".8" stroke-linejoin="round"/>' +
      '<path d="M' + avn(cx + w - 0.6) + ' ' + avn(y - 3.4) + ' L' + avn(cx + 1.4) + ' ' + avn(y + 11) +
      ' L' + avn(cx + w + 1.6) + ' ' + avn(y + 4) + ' Z" fill="' + pal.light + '" stroke="' + pal.dark +
      '" stroke-width=".8" stroke-linejoin="round"/>';
  }
  if (style === 'cardigan') {
    return '<path d="' + rim + '" stroke="' + pal.light + '" stroke-width="' + lw + '" fill="none" stroke-linecap="round"/>';
  }
  if (style === 'varsity') {
    return '<path d="' + rim + '" stroke="' + pal.dark + '" stroke-width="' + lw + '" fill="none" stroke-linecap="round"/>' +
      '<path d="' + rim + '" stroke="' + pal.accent + '" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".9"/>';
  }
  if (style === 'stripe') {
    return '<path d="' + rim + '" stroke="' + pal.accent + '" stroke-width="' + lw + '" fill="none" stroke-linecap="round"/>';
  }
  if (style === 'jersey') {
    return '<path d="' + rim + '" stroke="' + pal.dark + '" stroke-width="' + avn(Number(lw) + 1) + '" fill="none" stroke-linecap="round"/>';
  }
  if (style === 'anorak') {
    return '<path d="' + rim + '" stroke="' + pal.dark + '" stroke-width="' + avn(Number(lw) + 1.4) + '" fill="none" stroke-linecap="round"/>' +
      '<path d="' + rim + '" stroke="' + pal.main + '" stroke-width="1" fill="none" stroke-linecap="round" opacity=".6"/>';
  }
  if (style === 'overalls') {
    return '<path d="' + rim + '" stroke="' + avShade(pal.light, 0.94) + '" stroke-width="' + lw + '" fill="none" stroke-linecap="round"/>';
  }
  return '<path d="' + rim + '" stroke="' + pal.dark + '" stroke-width="' + lw + '" fill="none" stroke-linecap="round"/>';
}

function avTop(m, pal, a, uid) {
  const d = avTorsoPath(m);
  let s = '<path d="' + d + '" fill="' + pal.main + '"/>';
  s += avStyleFront(a.style, m, pal, d, uid);
  s += avCollar(a.style, m, pal);
  s += '<path d="' + d + '" fill="none" stroke="' + avShade(pal.main, 0.76) + '" stroke-width="1.1" opacity=".5"/>';
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

/* 짧은 머리 캡 — 머리통에 딱 붙는 짧은 머리를 그린다.
   outer: 정수리 높이(r 배수), inner: 이마 헤어라인 높이(r 배수),
   temple: 옆머리가 내려오는 정도(r 배수) */
function avHairCap(cx, hy, r, col, outer, inner, temple) {
  const L = cx - r, R = cx + r;
  const ty = hy + r * temple;
  return '<path d="M' + avn(L) + ' ' + avn(ty) +
    ' C' + avn(cx - r * 1.02) + ' ' + avn(hy - r * outer * 0.6) + ' ' + avn(cx - r * 0.6) + ' ' + avn(hy - r * outer) + ' ' + avn(cx) + ' ' + avn(hy - r * outer) +
    ' C' + avn(cx + r * 0.6) + ' ' + avn(hy - r * outer) + ' ' + avn(cx + r * 1.02) + ' ' + avn(hy - r * outer * 0.6) + ' ' + avn(R) + ' ' + avn(ty) +
    ' L' + avn(cx + r * 0.92) + ' ' + avn(hy + r * temple * 0.55) +
    ' C' + avn(cx + r * 0.94) + ' ' + avn(hy - r * inner * 0.55) + ' ' + avn(cx + r * 0.52) + ' ' + avn(hy - r * inner) + ' ' + avn(cx) + ' ' + avn(hy - r * inner) +
    ' C' + avn(cx - r * 0.52) + ' ' + avn(hy - r * inner) + ' ' + avn(cx - r * 0.94) + ' ' + avn(hy - r * inner * 0.55) + ' ' + avn(cx - r * 0.92) + ' ' + avn(hy + r * temple * 0.55) +
    ' Z" fill="' + col + '"/>';
}

/* 굵은 가닥 하나 — 드레드록·긴 머리카락을 둥근 획으로 그린다 */
function avHairStrand(x1, y1, qx, qy, x2, y2, w, col, op) {
  return '<path d="M' + avn(x1) + ' ' + avn(y1) + ' Q' + avn(qx) + ' ' + avn(qy) + ' ' + avn(x2) + ' ' + avn(y2) +
    '" stroke="' + col + '" stroke-width="' + avn(w) + '" fill="none" stroke-linecap="round"' +
    (op == null ? '' : ' opacity="' + op + '"') + '/>';
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
    // 낮게 묶은 번 — 뒤통수 아래로 도톰하게 보인다
    return '<circle cx="' + avn(cx - r * 0.9) + '" cy="' + avn(hy + r * 1.0) + '" r="' + avn(r * 0.46) + '" fill="' + col + '"/>' +
      '<path d="M' + avn(cx - r * 1.12) + ' ' + avn(hy + r * 0.86) +
      ' q' + avn(r * 0.3) + ' ' + avn(r * 0.26) + ' ' + avn(r * 0.52) + ' ' + avn(-r * 0.02) +
      '" stroke="' + sh + '" stroke-width="' + avn(r * 0.1) + '" fill="none" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M' + avn(cx - r * 1.14) + ' ' + avn(hy + r * 1.12) +
      ' q' + avn(r * 0.26) + ' ' + avn(r * 0.2) + ' ' + avn(r * 0.5) + ' ' + avn(r * 0.04) +
      '" stroke="' + sh + '" stroke-width="' + avn(r * 0.09) + '" fill="none" stroke-linecap="round" opacity=".55"/>' +
      '<ellipse cx="' + avn(cx - r * 1.02) + '" cy="' + avn(hy + r * 0.72) + '" rx="' + avn(r * 0.13) + '" ry="' + avn(r * 0.1) + '" fill="' + sh + '" opacity=".9"/>';
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
  if (a.hair === 'spiky') {
    // 짧게 친 목덜미 — 뾰족한 끝
    return '<path d="M' + avn(cx - r - 0.6) + ' ' + avn(hy - r * 0.34) +
      ' C' + avn(cx - r - 1.8) + ' ' + avn(hy + r * 0.3) + ' ' + avn(cx - r * 1.2) + ' ' + avn(hy + r * 0.5) + ' ' + avn(cx - r * 0.96) + ' ' + avn(hy + r * 0.6) +
      ' L' + avn(cx - r * 0.6) + ' ' + avn(hy + r * 0.44) +
      ' L' + avn(cx - r * 0.2) + ' ' + avn(hy + r * 0.62) +
      ' L' + avn(cx + r * 0.2) + ' ' + avn(hy + r * 0.44) +
      ' L' + avn(cx + r * 0.62) + ' ' + avn(hy + r * 0.6) +
      ' C' + avn(cx + r * 1.2) + ' ' + avn(hy + r * 0.5) + ' ' + avn(cx + r + 1.8) + ' ' + avn(hy + r * 0.3) + ' ' + avn(cx + r + 0.6) + ' ' + avn(hy - r * 0.34) + ' Z" fill="' + col + '"/>';
  }
  if (a.hair === 'curly') {
    // 뒤통수를 감싸는 곱슬 덩어리
    let c = '';
    [[-0.94, 0.05, 0.26], [0.94, 0.05, 0.26], [-0.86, -0.5, 0.24], [0.86, -0.5, 0.24], [0, 0.42, 0.3]].forEach(function (p) {
      c += '<circle cx="' + avn(cx + p[0] * r) + '" cy="' + avn(hy + p[1] * r) + '" r="' + avn(r * p[2]) + '" fill="' + col + '"/>';
    });
    return c;
  }
  if (a.hair === 'pony') {
    // 한쪽으로 흘러내리는 포니테일 — 뒤통수에 묶은 결
    return '<path d="M' + avn(cx + r * 0.46) + ' ' + avn(hy - r * 0.96) +
      ' C' + avn(cx + r * 1.46) + ' ' + avn(hy - r * 1.06) + ' ' + avn(cx + r * 1.56) + ' ' + avn(hy - r * 0.16) + ' ' + avn(cx + r * 1.16) + ' ' + avn(hy + r * 0.52) +
      '" stroke="' + col + '" stroke-width="' + avn(r * 0.46) + '" stroke-linecap="round" fill="none"/>' +
      '<path d="M' + avn(cx + r * 0.7) + ' ' + avn(hy - r * 0.72) +
      ' C' + avn(cx + r * 1.3) + ' ' + avn(hy - r * 0.72) + ' ' + avn(cx + r * 1.36) + ' ' + avn(hy - r * 0.1) + ' ' + avn(cx + r * 1.1) + ' ' + avn(hy + r * 0.3) +
      '" stroke="' + sh + '" stroke-width="' + avn(r * 0.09) + '" fill="none" stroke-linecap="round" opacity=".55"/>' +
      '<path d="M' + avn(cx + r * 0.94) + ' ' + avn(hy + r * 0.28) +
      ' C' + avn(cx + r * 1.16) + ' ' + avn(hy + r * 0.42) + ' ' + avn(cx + r * 1.06) + ' ' + avn(hy + r * 0.6) + ' ' + avn(cx + r * 0.94) + ' ' + avn(hy + r * 0.56) +
      '" stroke="' + sh + '" stroke-width="' + avn(r * 0.08) + '" fill="none" stroke-linecap="round" opacity=".45"/>';
  }
  if (a.hair === 'mohawk') {
    // 민 머리 — 뒤통수는 거의 드러나고 목덜미에 잔털만 남는다
    return '<path d="M' + avn(cx - r * 0.82) + ' ' + avn(hy + r * 0.82) +
      ' Q' + avn(cx) + ' ' + avn(hy + r * 1.04) + ' ' + avn(cx + r * 0.82) + ' ' + avn(hy + r * 0.82) +
      '" stroke="' + sh + '" stroke-width="' + avn(r * 0.09) + '" fill="none" stroke-linecap="round" opacity=".5"/>';
  }
  if (a.hair === 'dread') {
    // 귀 뒤로 늘어뜨린 굵은 드레드 가닥 — 실루엣을 만든다
    let d = '';
    [[-1.06, 1.34, 0.22], [-1.22, 1.56, 0.2], [-1.34, 1.16, 0.17],
      [1.06, 1.34, 0.22], [1.22, 1.56, 0.2], [1.34, 1.16, 0.17]].forEach(function (st) {
      const sd = st[0] < 0 ? -1 : 1;
      d += avHairStrand(cx + sd * r * 0.76, hy - r * 0.56, cx + sd * r * (Math.abs(st[0]) + 0.12), hy + r * 0.5,
        cx + st[0] * r, hy + st[1] * r, r * st[2], col, 1);
      d += avHairStrand(cx + sd * r * 0.76, hy - r * 0.52, cx + sd * r * (Math.abs(st[0]) + 0.1), hy + r * 0.5,
        cx + st[0] * r, hy + st[1] * r, r * st[2] * 0.3, sh, 0.5);
    });
    // 가닥을 묶은 구슬
    d += '<ellipse cx="' + avn(cx - r * 1.2) + '" cy="' + avn(hy + r * 0.5) + '" rx="' + avn(r * 0.09) + '" ry="' + avn(r * 0.065) + '" fill="#e8b56a"/>';
    d += '<ellipse cx="' + avn(cx + r * 1.2) + '" cy="' + avn(hy + r * 0.76) + '" rx="' + avn(r * 0.08) + '" ry="' + avn(r * 0.06) + '" fill="#7fd3c8"/>';
    return d;
  }
  if (a.hair === 'perm') {
    // 뒤통수를 감싸고 옆으로 크게 부푼 컬 덩어리
    let c = '';
    [[-1.0, -0.5, 0.27], [-1.14, -0.06, 0.26], [-1.04, 0.38, 0.24], [-0.72, 0.86, 0.25],
      [0, 1.04, 0.28], [0.72, 0.86, 0.25], [1.04, 0.38, 0.24], [1.14, -0.06, 0.26], [1.0, -0.5, 0.27],
      [-0.62, -0.98, 0.26], [0.04, -1.2, 0.27], [0.62, -0.98, 0.26]].forEach(function (p) {
      c += '<circle cx="' + avn(cx + p[0] * r) + '" cy="' + avn(hy + p[1] * r) + '" r="' + avn(r * p[2]) + '" fill="' + col + '"/>';
    });
    return c;
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
    s += avHairShell(cx, hy, r, col, 0.5, 0.58, 1.8);
    // 가운데서 갈라져 양옆으로 흐르는 커튼 앞머리 — 층마다 끝이 뾰족하다
    s += '<path d="M' + avn(cx - r * 0.04) + ' ' + avn(hy - r * 1.14) +
      ' C' + avn(cx - r * 0.5) + ' ' + avn(hy - r * 1.12) + ' ' + avn(cx - r * 0.9) + ' ' + avn(hy - r * 0.74) + ' ' + avn(cx - r * 0.95) + ' ' + avn(hy - r * 0.14) +
      ' L' + avn(cx - r * 0.8) + ' ' + avn(hy - r * 0.26) +
      ' L' + avn(cx - r * 0.7) + ' ' + avn(hy - r * 0.14) +
      ' L' + avn(cx - r * 0.56) + ' ' + avn(hy - r * 0.34) +
      ' L' + avn(cx - r * 0.38) + ' ' + avn(hy - r * 0.3) +
      ' C' + avn(cx - r * 0.24) + ' ' + avn(hy - r * 0.42) + ' ' + avn(cx - r * 0.1) + ' ' + avn(hy - r * 0.66) + ' ' + avn(cx - r * 0.04) + ' ' + avn(hy - r * 0.92) + ' Z" fill="' + col + '"/>';
    s += '<path d="M' + avn(cx + r * 0.05) + ' ' + avn(hy - r * 1.14) +
      ' C' + avn(cx + r * 0.5) + ' ' + avn(hy - r * 1.12) + ' ' + avn(cx + r * 0.9) + ' ' + avn(hy - r * 0.74) + ' ' + avn(cx + r * 0.95) + ' ' + avn(hy - r * 0.14) +
      ' L' + avn(cx + r * 0.8) + ' ' + avn(hy - r * 0.26) +
      ' L' + avn(cx + r * 0.7) + ' ' + avn(hy - r * 0.14) +
      ' L' + avn(cx + r * 0.56) + ' ' + avn(hy - r * 0.34) +
      ' L' + avn(cx + r * 0.38) + ' ' + avn(hy - r * 0.3) +
      ' C' + avn(cx + r * 0.24) + ' ' + avn(hy - r * 0.42) + ' ' + avn(cx + r * 0.1) + ' ' + avn(hy - r * 0.66) + ' ' + avn(cx + r * 0.05) + ' ' + avn(hy - r * 0.92) + ' Z" fill="' + col + '"/>';
    // 가운데 가르마 — 살결이 드러나는 가는 틈
    s += '<path d="M' + avn(cx + r * 0.01) + ' ' + avn(hy - r * 0.96) + ' L' + avn(cx + r * 0.02) + ' ' + avn(hy - r * 0.6) + '" stroke="' + AV_SKIN + '" stroke-width="' + avn(r * 0.05) + '" stroke-linecap="round"/>';
    // 층이 진 머리카락 선
    s += '<path d="M' + avn(cx + r * 0.74) + ' ' + avn(hy - r * 0.78) + ' C' + avn(cx + r * 0.9) + ' ' + avn(hy - r * 0.5) + ' ' + avn(cx + r * 0.94) + ' ' + avn(hy - r * 0.28) + ' ' + avn(cx + r * 0.86) + ' ' + avn(hy - r * 0.12) +
      '" stroke="' + sh + '" stroke-width="' + avn(r * 0.07) + '" fill="none" stroke-linecap="round" opacity=".5"/>';
    s += '<path d="M' + avn(cx - r * 0.64) + ' ' + avn(hy - r * 0.8) + ' C' + avn(cx - r * 0.82) + ' ' + avn(hy - r * 0.58) + ' ' + avn(cx - r * 0.9) + ' ' + avn(hy - r * 0.44) + ' ' + avn(cx - r * 0.9) + ' ' + avn(hy - r * 0.3) +
      '" stroke="' + sh + '" stroke-width="' + avn(r * 0.07) + '" fill="none" stroke-linecap="round" opacity=".45"/>';
    // 귀 앞으로 흘러내린 옆머리 — 끝은 뾰족하게
    s += '<path d="M' + avn(cx - r * 0.98) + ' ' + avn(hy - r * 0.12) +
      ' C' + avn(cx - r * 1.12) + ' ' + avn(hy + r * 0.24) + ' ' + avn(cx - r * 1.06) + ' ' + avn(hy + r * 0.5) + ' ' + avn(cx - r * 0.9) + ' ' + avn(hy + r * 0.76) +
      ' L' + avn(cx - r * 0.78) + ' ' + avn(hy + r * 0.46) +
      ' L' + avn(cx - r * 0.72) + ' ' + avn(hy + r * 0.4) +
      ' C' + avn(cx - r * 0.8) + ' ' + avn(hy + r * 0.16) + ' ' + avn(cx - r * 0.86) + ' ' + avn(hy + r * 0.02) + ' ' + avn(cx - r * 0.84) + ' ' + avn(hy - r * 0.12) + ' Z" fill="' + col + '"/>';
    s += '<path d="M' + avn(cx + r * 0.98) + ' ' + avn(hy - r * 0.12) +
      ' C' + avn(cx + r * 1.12) + ' ' + avn(hy + r * 0.24) + ' ' + avn(cx + r * 1.06) + ' ' + avn(hy + r * 0.5) + ' ' + avn(cx + r * 0.9) + ' ' + avn(hy + r * 0.76) +
      ' L' + avn(cx + r * 0.78) + ' ' + avn(hy + r * 0.46) +
      ' L' + avn(cx + r * 0.72) + ' ' + avn(hy + r * 0.4) +
      ' C' + avn(cx + r * 0.8) + ' ' + avn(hy + r * 0.16) + ' ' + avn(cx + r * 0.86) + ' ' + avn(hy + r * 0.02) + ' ' + avn(cx + r * 0.84) + ' ' + avn(hy - r * 0.12) + ' Z" fill="' + col + '"/>';
    s += '<path d="M' + avn(cx - r * 0.5) + ' ' + avn(hy - r * 1.02) + ' C' + avn(cx - r * 0.1) + ' ' + avn(hy - r * 0.9) + ' ' + avn(cx + r * 0.4) + ' ' + avn(hy - r * 0.92) + ' ' + avn(cx + r * 0.72) + ' ' + avn(hy - r * 0.72) +
      '" stroke="' + hi + '" stroke-width="' + avn(r * 0.07) + '" fill="none" stroke-linecap="round" opacity=".26"/>'
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
  } else if (a.hair === 'spiky') {
    s += avHairShell(cx, hy, r, col, 0.3, 0.84, 1.3);
    // 정수리 스파이크 — 위로 뾰족하게 솟은 결
    s += '<path d="M' + avn(cx - r * 0.86) + ' ' + avn(hy - r * 0.9) +
      ' L' + avn(cx - r * 0.72) + ' ' + avn(hy - r * 1.5) +
      ' L' + avn(cx - r * 0.46) + ' ' + avn(hy - r * 1.08) +
      ' L' + avn(cx - r * 0.18) + ' ' + avn(hy - r * 1.62) +
      ' L' + avn(cx + r * 0.06) + ' ' + avn(hy - r * 1.14) +
      ' L' + avn(cx + r * 0.34) + ' ' + avn(hy - r * 1.56) +
      ' L' + avn(cx + r * 0.56) + ' ' + avn(hy - r * 1.08) +
      ' L' + avn(cx + r * 0.8) + ' ' + avn(hy - r * 1.44) +
      ' L' + avn(cx + r * 0.86) + ' ' + avn(hy - r * 0.9) + ' Z" fill="' + col + '"/>';
    // 삐죽삐죽 앞머리 — 이마로 뾰족하게 내려오는 결
    s += '<path d="M' + avn(cx - r * 0.99) + ' ' + avn(hy - r * 0.86) +
      ' L' + avn(cx - r * 0.82) + ' ' + avn(hy - r * 0.38) +
      ' L' + avn(cx - r * 0.62) + ' ' + avn(hy - r * 0.88) +
      ' L' + avn(cx - r * 0.4) + ' ' + avn(hy - r * 0.34) +
      ' L' + avn(cx - r * 0.18) + ' ' + avn(hy - r * 0.88) +
      ' L' + avn(cx + r * 0.04) + ' ' + avn(hy - r * 0.36) +
      ' L' + avn(cx + r * 0.26) + ' ' + avn(hy - r * 0.88) +
      ' L' + avn(cx + r * 0.48) + ' ' + avn(hy - r * 0.34) +
      ' L' + avn(cx + r * 0.7) + ' ' + avn(hy - r * 0.86) +
      ' L' + avn(cx + r * 0.88) + ' ' + avn(hy - r * 0.4) +
      ' L' + avn(cx + r * 0.99) + ' ' + avn(hy - r * 0.86) + ' Z" fill="' + col + '"/>';
    // 정수리 결
    s += '<path d="M' + avn(cx - r * 0.3) + ' ' + avn(hy - r * 1.0) + ' C' + avn(cx + r * 0.1) + ' ' + avn(hy - r * 0.92) + ' ' + avn(cx + r * 0.5) + ' ' + avn(hy - r * 0.9) + ' ' + avn(cx + r * 0.8) + ' ' + avn(hy - r * 0.66) +
      '" stroke="' + hi + '" stroke-width="' + avn(r * 0.07) + '" fill="none" stroke-linecap="round" opacity=".26"/>';
  } else if (a.hair === 'curly') {
    s += avHairShell(cx, hy, r, col, 0.36, 0.72, 1.1);
    // 곱슬곱슬 — 동그란 컬을 둥글게
    [[-0.84, -0.6, 0.29], [-0.56, -0.98, 0.27], [-0.12, -1.14, 0.3], [0.36, -1.08, 0.27],
      [0.76, -0.84, 0.29], [0.98, -0.38, 0.25], [-0.98, -0.16, 0.24], [0.98, -0.1, 0.23],
      [-0.34, -0.62, 0.22], [0.3, -0.66, 0.22]].forEach(function (p) {
      s += '<circle cx="' + avn(cx + p[0] * r) + '" cy="' + avn(hy + p[1] * r) + '" r="' + avn(r * p[2]) + '" fill="' + col + '"/>';
    });
    s += '<path d="M' + avn(cx - r * 0.04) + ' ' + avn(hy - r * 0.96) + ' q' + avn(r * 0.3) + ' ' + avn(r * 0.16) + ' ' + avn(r * 0.1) + ' ' + avn(r * 0.34) +
      '" stroke="' + sh + '" stroke-width="' + avn(r * 0.06) + '" fill="none" stroke-linecap="round" opacity=".45"/>';
  } else if (a.hair === 'pony') {
    s += avHairShell(cx, hy, r, col, 0.3, 0.66, 1.2);
    // 옆으로 넘긴 앞머리
    s += '<path d="M' + avn(cx - r * 0.96) + ' ' + avn(hy - r * 0.2) +
      ' C' + avn(cx - r * 0.9) + ' ' + avn(hy - r * 0.74) + ' ' + avn(cx - r * 0.2) + ' ' + avn(hy - r * 0.98) + ' ' + avn(cx + r * 0.36) + ' ' + avn(hy - r * 0.9) +
      ' C' + avn(cx + r * 0.82) + ' ' + avn(hy - r * 0.84) + ' ' + avn(cx + r * 0.97) + ' ' + avn(hy - r * 0.54) + ' ' + avn(cx + r * 0.96) + ' ' + avn(hy - r * 0.2) +
      ' C' + avn(cx + r * 0.66) + ' ' + avn(hy - r * 0.54) + ' ' + avn(cx + r * 0.2) + ' ' + avn(hy - r * 0.62) + ' ' + avn(cx - r * 0.16) + ' ' + avn(hy - r * 0.5) +
      ' C' + avn(cx - r * 0.5) + ' ' + avn(hy - r * 0.38) + ' ' + avn(cx - r * 0.78) + ' ' + avn(hy - r * 0.42) + ' ' + avn(cx - r * 0.96) + ' ' + avn(hy - r * 0.2) + ' Z" fill="' + col + '"/>';
    // 묶은 머리끈
    s += '<ellipse cx="' + avn(cx + r * 0.62) + '" cy="' + avn(hy - r * 1.02) + '" rx="' + avn(r * 0.16) + '" ry="' + avn(r * 0.11) +
      '" fill="#f26d8d" transform="rotate(-24 ' + avn(cx + r * 0.62) + ' ' + avn(hy - r * 1.02) + ')"/>';
    s += '<path d="M' + avn(cx - r * 0.3) + ' ' + avn(hy - r * 1.02) + ' C' + avn(cx + r * 0.1) + ' ' + avn(hy - r * 0.94) + ' ' + avn(cx + r * 0.42) + ' ' + avn(hy - r * 0.92) + ' ' + avn(cx + r * 0.7) + ' ' + avn(hy - r * 0.7) +
      '" stroke="' + hi + '" stroke-width="' + avn(r * 0.07) + '" fill="none" stroke-linecap="round" opacity=".26"/>';
  } else if (a.hair === 'mohawk') {
    /* 옆머리는 밀어낸 모히칸 — 가운데 볏만 시원하게 솟는다 */
    // 민 머리 — 두피에 옅게 남은 잔털 틴트
    s += '<g opacity=".18">' + avHairCap(cx, hy, r, col, 1.02, 0.66, 0.04) + '</g>';
    // 귀 앞 잔털
    s += '<path d="M' + avn(cx - r * 0.95) + ' ' + avn(hy + r * 0.06) + ' L' + avn(cx - r * 0.9) + ' ' + avn(hy + r * 0.24) + '" stroke="' + col + '" stroke-width="' + avn(r * 0.05) + '" stroke-linecap="round" opacity=".3"/>';
    s += '<path d="M' + avn(cx + r * 0.95) + ' ' + avn(hy + r * 0.06) + ' L' + avn(cx + r * 0.9) + ' ' + avn(hy + r * 0.24) + '" stroke="' + col + '" stroke-width="' + avn(r * 0.05) + '" stroke-linecap="round" opacity=".3"/>';
    // 볏 — 가운데만 다섯 갈래로 뾰족하게 솟은 모히칸
    s += '<path d="M' + avn(cx - r * 0.42) + ' ' + avn(hy - r * 0.9) +
      ' C' + avn(cx - r * 0.46) + ' ' + avn(hy - r * 1.06) + ' ' + avn(cx - r * 0.45) + ' ' + avn(hy - r * 1.2) + ' ' + avn(cx - r * 0.4) + ' ' + avn(hy - r * 1.3) +
      ' L' + avn(cx - r * 0.3) + ' ' + avn(hy - r * 1.12) +
      ' L' + avn(cx - r * 0.2) + ' ' + avn(hy - r * 1.42) +
      ' L' + avn(cx - r * 0.1) + ' ' + avn(hy - r * 1.16) +
      ' L' + avn(cx + r * 0.02) + ' ' + avn(hy - r * 1.66) +
      ' L' + avn(cx + r * 0.12) + ' ' + avn(hy - r * 1.18) +
      ' L' + avn(cx + r * 0.24) + ' ' + avn(hy - r * 1.44) +
      ' L' + avn(cx + r * 0.32) + ' ' + avn(hy - r * 1.12) +
      ' L' + avn(cx + r * 0.42) + ' ' + avn(hy - r * 1.3) +
      ' C' + avn(cx + r * 0.46) + ' ' + avn(hy - r * 1.18) + ' ' + avn(cx + r * 0.46) + ' ' + avn(hy - r * 1.02) + ' ' + avn(cx + r * 0.4) + ' ' + avn(hy - r * 0.9) + ' Z" fill="' + col + '"/>';
    // 볏 밑동의 그늘 — 두피에 붙은 느낌
    s += '<path d="M' + avn(cx - r * 0.36) + ' ' + avn(hy - r * 0.92) + ' Q' + avn(cx) + ' ' + avn(hy - r * 1.04) + ' ' + avn(cx + r * 0.36) + ' ' + avn(hy - r * 0.92) + '" stroke="' + sh + '" stroke-width="' + avn(r * 0.09) + '" fill="none" stroke-linecap="round" opacity=".45"/>';
    // 볏의 광택
    s += '<path d="M' + avn(cx - r * 0.16) + ' ' + avn(hy - r * 1.02) + ' L' + avn(cx - r * 0.06) + ' ' + avn(hy - r * 1.44) + '" stroke="' + hi + '" stroke-width="' + avn(r * 0.07) + '" fill="none" stroke-linecap="round" opacity=".35"/>'
  } else if (a.hair === 'dread') {
    /* 굵은 드레드록 가닥이 정수리에서 이마와 볼 옆으로 늘어진다 */
    // 가닥 사이로 살결이 보이도록, 매끈한 덩어리 없이 밧줄만 세운다
    [[-1.04, 0.72, 0.2], [-0.74, -0.3, 0.2], [-0.42, -0.42, 0.21], [-0.08, -0.48, 0.21],
      [0.26, -0.46, 0.21], [0.58, -0.38, 0.2], [0.88, 0.02, 0.2], [1.08, 0.62, 0.19]].forEach(function (p) {
      const x0 = cx + p[0] * r * 0.6;
      const x1 = cx + p[0] * r;
      const y1 = hy + p[1] * r;
      const top = hy - r * (Math.abs(p[0]) > 0.9 ? 0.86 : 1.02);
      s += avHairStrand(x0, top, cx + p[0] * r * 0.92, hy - r * 0.5, x1, y1, r * p[2], col, 1);
      s += avHairStrand(x0, top + r * 0.04, cx + p[0] * r * 0.92, hy - r * 0.5, x1, y1, r * p[2] * 0.24, hi, 0.28);
      // 꼬인 결 — 가닥을 가로지르는 짧은 선
      [0.36, 0.62, 0.84].forEach(function (t) {
        const px = x0 + (x1 - x0) * t;
        const py = top + (y1 - top) * t;
        s += '<path d="M' + avn(px - r * 0.055) + ' ' + avn(py) + ' L' + avn(px + r * 0.055) + ' ' + avn(py + r * 0.05) +
          '" stroke="' + sh + '" stroke-width="' + avn(r * 0.045) + '" stroke-linecap="round" opacity=".45"/>';
      });
    });
    // 귀 앞으로 늘어진 긴 밧줄 가닥
    [[-1.12, 1.14, 0.21], [1.12, 1.14, 0.21], [-1.26, 0.74, 0.18], [1.26, 0.74, 0.18]].forEach(function (p) {
      const sd = p[0] < 0 ? -1 : 1;
      s += avHairStrand(cx + sd * r * 0.84, hy - r * 0.24, cx + sd * r * 1.16, hy + r * 0.46, cx + p[0] * r, hy + p[1] * r, r * p[2], col, 1);
      s += avHairStrand(cx + sd * r * 0.84, hy - r * 0.2, cx + sd * r * 1.16, hy + r * 0.46, cx + p[0] * r, hy + p[1] * r, r * p[2] * 0.24, hi, 0.24);
    });
    // 가닥을 묶은 구슬
    s += '<ellipse cx="' + avn(cx - r * 1.06) + '" cy="' + avn(hy + r * 0.46) + '" rx="' + avn(r * 0.095) + '" ry="' + avn(r * 0.07) + '" fill="#e0a86a"/>';
    s += '<ellipse cx="' + avn(cx + r * 1.06) + '" cy="' + avn(hy + r * 0.74) + '" rx="' + avn(r * 0.09) + '" ry="' + avn(r * 0.065) + '" fill="#78cfc4"/>'
  } else if (a.hair === 'perm') {
    /* 몽글몽글 풍성하게 부푼 볼륨 펌 */
    s += avHairShell(cx, hy, r, col, 0.62, 0.5, 1.5);
    // 머리보다 넓게 부풀어 오른 컬 덩어리
    [[-1.0, -0.66, 0.27], [-1.14, -0.22, 0.26], [-1.08, 0.26, 0.24], [-0.84, -1.04, 0.27], [-0.42, -1.22, 0.27],
      [0.04, -1.28, 0.27], [0.5, -1.2, 0.27], [0.86, -1.02, 0.27], [1.12, -0.2, 0.26], [1.06, 0.28, 0.24],
      [-0.66, -0.42, 0.22], [0.66, -0.42, 0.22]].forEach(function (p) {
      s += '<circle cx="' + avn(cx + p[0] * r) + '" cy="' + avn(hy + p[1] * r) + '" r="' + avn(r * p[2]) + '" fill="' + col + '"/>';
    });
    // 이마 위 둥근 앞머리 컬
    [[-0.6, -0.5, 0.23], [-0.2, -0.56, 0.24], [0.22, -0.54, 0.24], [0.62, -0.48, 0.22]].forEach(function (p) {
      s += '<circle cx="' + avn(cx + p[0] * r) + '" cy="' + avn(hy + p[1] * r) + '" r="' + avn(r * p[2]) + '" fill="' + col + '"/>';
    });
    // 컬의 결 — 몽글몽글한 소용돌이
    s += '<path d="M' + avn(cx - r * 1.08) + ' ' + avn(hy - r * 0.44) + ' q' + avn(r * 0.16) + ' ' + avn(r * 0.16) + ' ' + avn(r * 0.02) + ' ' + avn(r * 0.32) + '" stroke="' + sh + '" stroke-width="' + avn(r * 0.055) + '" fill="none" stroke-linecap="round" opacity=".5"/>';
    s += '<path d="M' + avn(cx + r * 1.06) + ' ' + avn(hy - r * 0.4) + ' q' + avn(-r * 0.16) + ' ' + avn(r * 0.16) + ' ' + avn(-r * 0.02) + ' ' + avn(r * 0.32) + '" stroke="' + sh + '" stroke-width="' + avn(r * 0.055) + '" fill="none" stroke-linecap="round" opacity=".5"/>';
    s += '<path d="M' + avn(cx - r * 0.3) + ' ' + avn(hy - r * 1.12) + ' q' + avn(r * 0.2) + ' ' + avn(-r * 0.1) + ' ' + avn(r * 0.36) + ' ' + avn(r * 0.04) + '" stroke="' + hi + '" stroke-width="' + avn(r * 0.06) + '" fill="none" stroke-linecap="round" opacity=".3"/>';
    s += '<path d="M' + avn(cx + r * 0.82) + ' ' + avn(hy - r * 0.86) + ' q' + avn(r * 0.16) + ' ' + avn(r * 0.14) + ' ' + avn(r * 0.1) + ' ' + avn(r * 0.3) + '" stroke="' + hi + '" stroke-width="' + avn(r * 0.06) + '" fill="none" stroke-linecap="round" opacity=".3"/>';
  } else if (a.hair === 'twoblock') {
    /* 투블럭 · 댄디 — 옆은 짧게, 윗머리는 반듯한 앞머리로 덮는다 */
    s += avHairCap(cx, hy, r, col, 1.05, 0.5, 0.06);
    // 윗머리 — 옆으로 살짝 넘치는 반듯한 덩어리
    s += '<path d="M' + avn(cx - r * 1.05) + ' ' + avn(hy - r * 0.36) +
      ' C' + avn(cx - r * 1.09) + ' ' + avn(hy - r * 0.96) + ' ' + avn(cx - r * 0.62) + ' ' + avn(hy - r * 1.24) + ' ' + avn(cx) + ' ' + avn(hy - r * 1.24) +
      ' C' + avn(cx + r * 0.62) + ' ' + avn(hy - r * 1.24) + ' ' + avn(cx + r * 1.09) + ' ' + avn(hy - r * 0.96) + ' ' + avn(cx + r * 1.05) + ' ' + avn(hy - r * 0.36) +
      ' L' + avn(cx + r * 0.9) + ' ' + avn(hy - r * 0.44) +
      ' C' + avn(cx + r * 0.56) + ' ' + avn(hy - r * 0.52) + ' ' + avn(cx + r * 0.2) + ' ' + avn(hy - r * 0.48) + ' ' + avn(cx) + ' ' + avn(hy - r * 0.48) +
      ' C' + avn(cx - r * 0.2) + ' ' + avn(hy - r * 0.48) + ' ' + avn(cx - r * 0.56) + ' ' + avn(hy - r * 0.52) + ' ' + avn(cx - r * 0.9) + ' ' + avn(hy - r * 0.44) + ' Z" fill="' + col + '"/>';
    // 투블럭 경계 — 귀 위에서 반듯하게 끊기는 선
    s += '<path d="M' + avn(cx - r * 1.04) + ' ' + avn(hy - r * 0.34) + ' L' + avn(cx - r * 0.84) + ' ' + avn(hy - r * 0.48) + '" stroke="' + avShade(col, 0.45) + '" stroke-width="' + avn(r * 0.06) + '" stroke-linecap="round" opacity=".55"/>';
    s += '<path d="M' + avn(cx + r * 1.04) + ' ' + avn(hy - r * 0.34) + ' L' + avn(cx + r * 0.84) + ' ' + avn(hy - r * 0.48) + '" stroke="' + avShade(col, 0.45) + '" stroke-width="' + avn(r * 0.06) + '" stroke-linecap="round" opacity=".55"/>';
    // 앞머리 결
    s += '<path d="M' + avn(cx - r * 0.4) + ' ' + avn(hy - r * 1.14) + ' C' + avn(cx - r * 0.34) + ' ' + avn(hy - r * 0.92) + ' ' + avn(cx - r * 0.3) + ' ' + avn(hy - r * 0.7) + ' ' + avn(cx - r * 0.28) + ' ' + avn(hy - r * 0.5) + '" stroke="' + hi + '" stroke-width="' + avn(r * 0.055) + '" fill="none" stroke-linecap="round" opacity=".28"/>';
    s += '<path d="M' + avn(cx + r * 0.4) + ' ' + avn(hy - r * 1.14) + ' C' + avn(cx + r * 0.44) + ' ' + avn(hy - r * 0.92) + ' ' + avn(cx + r * 0.46) + ' ' + avn(hy - r * 0.7) + ' ' + avn(cx + r * 0.46) + ' ' + avn(hy - r * 0.5) + '" stroke="' + hi + '" stroke-width="' + avn(r * 0.055) + '" fill="none" stroke-linecap="round" opacity=".28"/>'
  } else if (a.hair === 'part') {
    /* 6:4 가르마 — 한쪽으로 크게 넘긴 앞머리 */
    s += avHairCap(cx, hy, r, col, 1.06, 0.52, 0.26);
    // 큰 쪽 — 오른쪽으로 크게 넘긴 앞머리
    s += '<path d="M' + avn(cx + r * 0.18) + ' ' + avn(hy - r * 1.16) +
      ' C' + avn(cx + r * 0.5) + ' ' + avn(hy - r * 1.14) + ' ' + avn(cx + r * 0.94) + ' ' + avn(hy - r * 0.88) + ' ' + avn(cx + r * 0.98) + ' ' + avn(hy - r * 0.34) +
      ' L' + avn(cx + r * 0.86) + ' ' + avn(hy - r * 0.36) +
      ' C' + avn(cx + r * 0.82) + ' ' + avn(hy - r * 0.6) + ' ' + avn(cx + r * 0.56) + ' ' + avn(hy - r * 0.76) + ' ' + avn(cx + r * 0.34) + ' ' + avn(hy - r * 0.7) +
      ' C' + avn(cx + r * 0.28) + ' ' + avn(hy - r * 0.9) + ' ' + avn(cx + r * 0.23) + ' ' + avn(hy - r * 1.04) + ' ' + avn(cx + r * 0.18) + ' ' + avn(hy - r * 1.16) + ' Z" fill="' + col + '"/>';
    // 작은 쪽 — 가르마에서 왼쪽으로 흐르는 결
    s += '<path d="M' + avn(cx + r * 0.14) + ' ' + avn(hy - r * 1.14) +
      ' C' + avn(cx - r * 0.1) + ' ' + avn(hy - r * 0.98) + ' ' + avn(cx - r * 0.58) + ' ' + avn(hy - r * 0.88) + ' ' + avn(cx - r * 0.86) + ' ' + avn(hy - r * 0.54) +
      ' L' + avn(cx - r * 0.88) + ' ' + avn(hy - r * 0.3) +
      ' C' + avn(cx - r * 0.86) + ' ' + avn(hy - r * 0.56) + ' ' + avn(cx - r * 0.48) + ' ' + avn(hy - r * 0.68) + ' ' + avn(cx - r * 0.1) + ' ' + avn(hy - r * 0.62) +
      ' C' + avn(cx + r * 0.02) + ' ' + avn(hy - r * 0.86) + ' ' + avn(cx + r * 0.1) + ' ' + avn(hy - r * 1.02) + ' ' + avn(cx + r * 0.14) + ' ' + avn(hy - r * 1.14) + ' Z" fill="' + col + '"/>';
    // 가르마 선 — 살결이 드러나는 가는 틈
    s += '<path d="M' + avn(cx + r * 0.21) + ' ' + avn(hy - r * 1.12) + ' L' + avn(cx + r * 0.15) + ' ' + avn(hy - r * 0.58) + '" stroke="' + AV_SKIN + '" stroke-width="' + avn(r * 0.055) + '" stroke-linecap="round"/>';
    // 넘긴 결의 광택과 그늘
    s += '<path d="M' + avn(cx + r * 0.42) + ' ' + avn(hy - r * 0.98) + ' C' + avn(cx + r * 0.72) + ' ' + avn(hy - r * 0.82) + ' ' + avn(cx + r * 0.86) + ' ' + avn(hy - r * 0.62) + ' ' + avn(cx + r * 0.88) + ' ' + avn(hy - r * 0.44) + '" stroke="' + hi + '" stroke-width="' + avn(r * 0.07) + '" fill="none" stroke-linecap="round" opacity=".3"/>';
    s += '<path d="M' + avn(cx - r * 0.42) + ' ' + avn(hy - r * 0.92) + ' C' + avn(cx - r * 0.66) + ' ' + avn(hy - r * 0.8) + ' ' + avn(cx - r * 0.8) + ' ' + avn(hy - r * 0.58) + ' ' + avn(cx - r * 0.84) + ' ' + avn(hy - r * 0.34) + '" stroke="' + sh + '" stroke-width="' + avn(r * 0.055) + '" fill="none" stroke-linecap="round" opacity=".4"/>'
  } else if (a.hair === 'pomade') {
    /* 올백 · 포마드 — 이마를 드러내고 위로 매끈하게 넘긴 스타일 */
    s += '<path d="M' + avn(cx - r * 1.02) + ' ' + avn(hy - r * 0.1) +
      ' C' + avn(cx - r * 1.06) + ' ' + avn(hy - r * 0.86) + ' ' + avn(cx - r * 0.56) + ' ' + avn(hy - r * 1.34) + ' ' + avn(cx + r * 0.04) + ' ' + avn(hy - r * 1.34) +
      ' C' + avn(cx + r * 0.6) + ' ' + avn(hy - r * 1.34) + ' ' + avn(cx + r * 1.06) + ' ' + avn(hy - r * 0.86) + ' ' + avn(cx + r * 1.02) + ' ' + avn(hy - r * 0.1) +
      ' L' + avn(cx + r * 0.96) + ' ' + avn(hy - r * 0.14) +
      ' C' + avn(cx + r * 0.9) + ' ' + avn(hy - r * 0.44) + ' ' + avn(cx + r * 0.86) + ' ' + avn(hy - r * 0.6) + ' ' + avn(cx + r * 0.66) + ' ' + avn(hy - r * 0.72) +
      ' C' + avn(cx + r * 0.44) + ' ' + avn(hy - r * 0.84) + ' ' + avn(cx - r * 0.02) + ' ' + avn(hy - r * 0.86) + ' ' + avn(cx - r * 0.36) + ' ' + avn(hy - r * 0.78) +
      ' C' + avn(cx - r * 0.68) + ' ' + avn(hy - r * 0.7) + ' ' + avn(cx - r * 0.86) + ' ' + avn(hy - r * 0.56) + ' ' + avn(cx - r * 0.94) + ' ' + avn(hy - r * 0.3) + ' Z" fill="' + col + '"/>';
    // 빗질한 결 — 뒤통수로 흐르는 선
    [[-0.68, -0.66, -0.5, -1.16], [-0.26, -0.78, -0.14, -1.24], [0.24, -0.78, 0.34, -1.22], [0.66, -0.66, 0.76, -1.12]].forEach(function (p) {
      s += '<path d="M' + avn(cx + r * p[0]) + ' ' + avn(hy + r * p[1]) + ' Q' + avn(cx + r * (p[0] + p[2]) / 2) + ' ' + avn(hy + r * ((p[1] + p[3]) / 2) - r * 0.05) + ' ' + avn(cx + r * p[2]) + ' ' + avn(hy + r * p[3]) + '" stroke="' + sh + '" stroke-width="' + avn(r * 0.045) + '" fill="none" stroke-linecap="round" opacity=".4"/>';
    });
    // 광택 — 매끈하게 넘긴 윤
    s += '<path d="M' + avn(cx - r * 0.62) + ' ' + avn(hy - r * 1.06) + ' C' + avn(cx - r * 0.24) + ' ' + avn(hy - r * 1.2) + ' ' + avn(cx + r * 0.26) + ' ' + avn(hy - r * 1.18) + ' ' + avn(cx + r * 0.6) + ' ' + avn(hy - r * 1.02) + '" stroke="' + hi + '" stroke-width="' + avn(r * 0.07) + '" fill="none" stroke-linecap="round" opacity=".26"/>';
    // 헤어라인 결 — 이마 위로 넘긴 잔머리
    s += '<path d="M' + avn(cx - r * 0.5) + ' ' + avn(hy - r * 0.78) + ' C' + avn(cx - r * 0.2) + ' ' + avn(hy - r * 0.84) + ' ' + avn(cx + r * 0.2) + ' ' + avn(hy - r * 0.84) + ' ' + avn(cx + r * 0.5) + ' ' + avn(hy - r * 0.76) + '" stroke="' + sh + '" stroke-width="' + avn(r * 0.05) + '" fill="none" stroke-linecap="round" opacity=".35"/>';
  } else if (a.hair === 'buzz') {
    /* 반삭 — 아주 짧고 깔끔하게 머리에 붙는 버즈컷 */
    s += avHairCap(cx, hy, r, col, 1.05, 0.52, 0.02);
    // 잔털 질감 — 짧은 머리의 결
    [[-0.66, -0.72], [-0.36, -0.84], [-0.04, -0.9], [0.34, -0.86], [0.66, -0.7],
      [-0.88, -0.34], [-0.9, -0.1], [0.88, -0.34], [0.9, -0.1], [-0.8, -0.52], [0.8, -0.52],
      [-0.5, -0.5], [0.5, -0.5], [-0.18, -0.56], [0.2, -0.54], [-0.3, -0.24], [0.32, -0.26]].forEach(function (p) {
      s += '<circle cx="' + avn(cx + p[0] * r) + '" cy="' + avn(hy + p[1] * r) + '" r="' + avn(r * 0.036) + '" fill="' + hi + '" opacity=".3"/>';
    });
    // 짧은 구레나룻
    s += '<path d="M' + avn(cx - r * 0.96) + ' ' + avn(hy + r * 0.02) + ' L' + avn(cx - r * 0.9) + ' ' + avn(hy + r * 0.26) + '" stroke="' + col + '" stroke-width="' + avn(r * 0.1) + '" stroke-linecap="round"/>';
    s += '<path d="M' + avn(cx + r * 0.96) + ' ' + avn(hy + r * 0.02) + ' L' + avn(cx + r * 0.9) + ' ' + avn(hy + r * 0.26) + '" stroke="' + col + '" stroke-width="' + avn(r * 0.1) + '" stroke-linecap="round"/>'
  } else if (a.hair === 'wave') {
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

/* ─────────── 표정 ───────────
   눈·눈썹·입을 크고 선명하게 그려, 무대 위 작은 크기에서도 읽힌다.
   성별을 고정하지 않는 톤 유지. */
function avFace(kind, cx, hy, r) {
  const ex = r * 0.42;
  const ey = hy + r * 0.10;
  const erx = r * 0.175, ery = r * 0.21;
  const browY = ey - r * 0.46;
  const my = hy + r * 0.62;
  const LIP = '#8a5a4c';
  let s = '';

  const eyeBall = function (x, y, rx, ry) {
    let e = '<ellipse cx="' + avn(x) + '" cy="' + avn(y) + '" rx="' + avn(rx) + '" ry="' + avn(ry) + '" fill="' + AV_INK + '"/>';
    e += '<circle cx="' + avn(x + rx * 0.34) + '" cy="' + avn(y - ry * 0.42) + '" r="' + avn(r * 0.05) + '" fill="#ffffff"/>';
    e += '<circle cx="' + avn(x - rx * 0.3) + '" cy="' + avn(y + ry * 0.36) + '" r="' + avn(r * 0.026) + '" fill="#ffffff" opacity=".75"/>';
    return e;
  };
  const brow = function (x, y, tilt, w) {
    const hw = (w || r * 0.225);
    return '<path d="M' + avn(x - hw) + ' ' + avn(y + tilt) + ' Q' + avn(x) + ' ' + avn(y - r * 0.095 + tilt) +
      ' ' + avn(x + hw) + ' ' + avn(y - tilt) + '" stroke="' + AV_INK + '" stroke-width="' + avn(r * 0.095) +
      '" fill="none" stroke-linecap="round" opacity=".92"/>';
  };
  const happyEye = function (x, y) {
    return '<path d="M' + avn(x - r * 0.155) + ' ' + avn(y + r * 0.06) + ' Q' + avn(x) + ' ' + avn(y - r * 0.14) +
      ' ' + avn(x + r * 0.155) + ' ' + avn(y + r * 0.06) + '" stroke="' + AV_INK +
      '" stroke-width="' + avn(r * 0.105) + '" fill="none" stroke-linecap="round"/>';
  };
  const starEye = function (x, y, sc) {
    const k = r * (sc || 0.21);
    return '<path d="M' + avn(x) + ' ' + avn(y - k) +
      ' L' + avn(x + k * 0.32) + ' ' + avn(y - k * 0.32) + ' L' + avn(x + k) + ' ' + avn(y) +
      ' L' + avn(x + k * 0.32) + ' ' + avn(y + k * 0.32) + ' L' + avn(x) + ' ' + avn(y + k) +
      ' L' + avn(x - k * 0.32) + ' ' + avn(y + k * 0.32) + ' L' + avn(x - k) + ' ' + avn(y) +
      ' L' + avn(x - k * 0.32) + ' ' + avn(y - k * 0.32) + ' Z" fill="#fbbf24" stroke="' + AV_INK +
      '" stroke-width="' + avn(r * 0.035) + '" stroke-linejoin="round"/>';
  };
  const blush = '<ellipse cx="' + avn(cx - r * 0.60) + '" cy="' + avn(hy + r * 0.44) + '" rx="' + avn(r * 0.16) +
    '" ry="' + avn(r * 0.09) + '" fill="#f6a9a0" opacity=".34"/>' +
    '<ellipse cx="' + avn(cx + r * 0.60) + '" cy="' + avn(hy + r * 0.44) + '" rx="' + avn(r * 0.16) +
    '" ry="' + avn(r * 0.09) + '" fill="#f6a9a0" opacity=".34"/>';
  const openMouth = function (w, h) {
    return '<path d="M' + avn(cx - w) + ' ' + avn(my - r * 0.05) + ' Q' + avn(cx) + ' ' + avn(my + h) +
      ' ' + avn(cx + w) + ' ' + avn(my - r * 0.05) + ' Z" fill="#a85452"/>' +
      '<path d="M' + avn(cx - w * 0.6) + ' ' + avn(my + h * 0.40) + ' Q' + avn(cx) + ' ' + avn(my + h * 0.74) +
      ' ' + avn(cx + w * 0.6) + ' ' + avn(my + h * 0.40) + ' Z" fill="#e08f8c"/>';
  };
  const sparkle = function (x, y, sc) {
    const k = r * (sc || 0.1);
    return '<path d="M' + avn(x) + ' ' + avn(y - k) + ' l' + avn(k * 0.32) + ' ' + avn(k * 0.68) +
      ' l' + avn(k * 0.68) + ' ' + avn(k * 0.32) + ' l' + avn(-k * 0.68) + ' ' + avn(k * 0.32) +
      ' l' + avn(-k * 0.32) + ' ' + avn(k * 0.68) + ' l' + avn(-k * 0.32) + ' ' + avn(-k * 0.68) +
      ' l' + avn(-k * 0.68) + ' ' + avn(-k * 0.32) + ' l' + avn(k * 0.68) + ' ' + avn(-k * 0.32) + ' Z" fill="#fbbf24"/>';
  };

  if (kind === 'smile') {
    s += brow(cx - ex, browY, 0) + brow(cx + ex, browY, 0);
    s += eyeBall(cx - ex, ey, erx, ery) + eyeBall(cx + ex, ey, erx, ery);
    s += blush;
    s += '<path d="M' + avn(cx - r * 0.25) + ' ' + avn(my - r * 0.06) + ' Q' + avn(cx) + ' ' + avn(my + r * 0.34) +
      ' ' + avn(cx + r * 0.25) + ' ' + avn(my - r * 0.06) + '" stroke="' + LIP +
      '" stroke-width="' + avn(r * 0.11) + '" fill="none" stroke-linecap="round"/>';

  } else if (kind === 'grin') {
    s += brow(cx - ex, browY - r * 0.06, 0) + brow(cx + ex, browY - r * 0.06, 0);
    s += happyEye(cx - ex, ey) + happyEye(cx + ex, ey);
    s += blush;
    s += openMouth(r * 0.27, r * 0.36);

  } else if (kind === 'wink') {
    s += brow(cx - ex, browY, 0) + brow(cx + ex, browY - r * 0.08, 0);
    s += eyeBall(cx - ex, ey, erx, ery);
    s += happyEye(cx + ex, ey);
    s += blush;
    s += '<path d="M' + avn(cx - r * 0.2) + ' ' + avn(my) + ' Q' + avn(cx + r * 0.05) + ' ' + avn(my + r * 0.26) +
      ' ' + avn(cx + r * 0.23) + ' ' + avn(my - r * 0.06) + '" stroke="' + LIP +
      '" stroke-width="' + avn(r * 0.1) + '" fill="none" stroke-linecap="round"/>';

  } else if (kind === 'focus') {
    s += brow(cx - ex, browY + r * 0.03, r * 0.1) + brow(cx + ex, browY + r * 0.03, -r * 0.1);
    s += '<ellipse cx="' + avn(cx - ex) + '" cy="' + avn(ey) + '" rx="' + avn(erx * 1.05) + '" ry="' + avn(ery * 0.58) +
      '" fill="' + AV_INK + '"/>';
    s += '<ellipse cx="' + avn(cx + ex) + '" cy="' + avn(ey) + '" rx="' + avn(erx * 1.05) + '" ry="' + avn(ery * 0.58) +
      '" fill="' + AV_INK + '"/>';
    s += '<circle cx="' + avn(cx - ex + erx * 0.3) + '" cy="' + avn(ey - ery * 0.2) + '" r="' + avn(r * 0.038) + '" fill="#fff"/>';
    s += '<circle cx="' + avn(cx + ex + erx * 0.3) + '" cy="' + avn(ey - ery * 0.2) + '" r="' + avn(r * 0.038) + '" fill="#fff"/>';
    s += '<path d="M' + avn(cx - r * 0.17) + ' ' + avn(my + r * 0.04) + ' L' + avn(cx + r * 0.17) + ' ' + avn(my + r * 0.04) +
      '" stroke="' + LIP + '" stroke-width="' + avn(r * 0.1) + '" stroke-linecap="round"/>';

  } else if (kind === 'wow') {
    s += brow(cx - ex, browY - r * 0.1, 0) + brow(cx + ex, browY - r * 0.1, 0);
    s += '<circle cx="' + avn(cx - ex) + '" cy="' + avn(ey) + '" r="' + avn(r * 0.19) + '" fill="#ffffff" stroke="' + AV_INK +
      '" stroke-width="' + avn(r * 0.045) + '"/>';
    s += '<circle cx="' + avn(cx + ex) + '" cy="' + avn(ey) + '" r="' + avn(r * 0.19) + '" fill="#ffffff" stroke="' + AV_INK +
      '" stroke-width="' + avn(r * 0.045) + '"/>';
    s += '<circle cx="' + avn(cx - ex) + '" cy="' + avn(ey) + '" r="' + avn(r * 0.085) + '" fill="' + AV_INK + '"/>';
    s += '<circle cx="' + avn(cx + ex) + '" cy="' + avn(ey) + '" r="' + avn(r * 0.085) + '" fill="' + AV_INK + '"/>';
    s += blush;
    s += '<ellipse cx="' + avn(cx) + '" cy="' + avn(my + r * 0.04) + '" rx="' + avn(r * 0.15) + '" ry="' + avn(r * 0.19) +
      '" fill="#a85452"/>';
    s += '<ellipse cx="' + avn(cx) + '" cy="' + avn(my + r * 0.13) + '" rx="' + avn(r * 0.1) + '" ry="' + avn(r * 0.07) +
      '" fill="#e08f8c"/>';
    s += sparkle(cx + r * 0.86, hy - r * 0.72, 0.11) + sparkle(cx - r * 1.14, hy - r * 0.5, 0.08);

  } else if (kind === 'tongue') {
    s += brow(cx - ex, browY - r * 0.02, 0) + brow(cx + ex, browY + r * 0.04, 0);
    s += happyEye(cx - ex, ey);
    s += eyeBall(cx + ex, ey, erx * 0.98, ery * 0.98);
    s += blush;
    s += openMouth(r * 0.24, r * 0.3);
    s += '<ellipse cx="' + avn(cx + r * 0.04) + '" cy="' + avn(my + r * 0.26) + '" rx="' + avn(r * 0.115) + '" ry="' + avn(r * 0.13) +
      '" fill="#e08f8c" stroke="#a85452" stroke-width="' + avn(r * 0.03) + '"/>';

  } else if (kind === 'pout') {
    s += brow(cx - ex, browY + r * 0.04, -r * 0.07) + brow(cx + ex, browY + r * 0.04, r * 0.07);
    s += eyeBall(cx - ex, ey, erx * 0.94, ery * 0.94) + eyeBall(cx + ex, ey, erx * 0.94, ery * 0.94);
    s += blush;
    s += '<path d="M' + avn(cx - r * 0.13) + ' ' + avn(my + r * 0.09) + ' Q' + avn(cx) + ' ' + avn(my - r * 0.06) +
      ' ' + avn(cx + r * 0.13) + ' ' + avn(my + r * 0.09) + '" stroke="' + LIP +
      '" stroke-width="' + avn(r * 0.1) + '" fill="none" stroke-linecap="round"/>';
    s += '<ellipse cx="' + avn(cx) + '" cy="' + avn(my + r * 0.14) + '" rx="' + avn(r * 0.075) + '" ry="' + avn(r * 0.05) +
      '" fill="#c9736b" opacity=".85"/>';

  } else {
    /* star — 반짝이는 눈 */
    s += brow(cx - ex, browY - r * 0.06, 0) + brow(cx + ex, browY - r * 0.06, 0);
    s += starEye(cx - ex, ey, 0.22) + starEye(cx + ex, ey, 0.22);
    s += blush;
    s += openMouth(r * 0.24, r * 0.3);
    s += sparkle(cx + r * 0.92, hy - r * 0.62, 0.09);
  }
  return s;
}

/* ─────────── 완성 ─────────── */
function avSVG(value, opt) {
  const a = normalizeAvatar(value);
  if (a.emoji) return '';
  const o = opt || {};
  const m = avM(a.body);
  const pal = AV_STYLE[a.style] || AV_STYLE.hoodie;
  const hair = AV_HAIR_COLOR[a.hair] || '#302c38';
  const uid = 'av' + (++AV_UID);

  let g = '';
  /* 발밑 그림자 — 무대 위에 서 있는 느낌 */
  g += '<ellipse cx="50" cy="' + avn(m.soleY + 3.4) + '" rx="' + avn(m.hipw + 4.5) + '" ry="3.2" fill="#1e1b4b" opacity=".16"/>';
  g += avHairBack(a, 50, m.cy, m.r, hair);
  g += avStyleBehind(a.style, m, pal);
  g += avBottoms(m, pal);
  g += avNeck(m);                 /* 옷보다 먼저 — 옷이 목 아래를 덮는다 */
  g += avArms(m, pal);
  g += avTop(m, pal, a, uid);
  g += avHands(m);
  g += avEars(m);
  g += '<ellipse cx="50" cy="' + avn(m.cy) + '" rx="' + avn(m.r) + '" ry="' + avn(m.r * 1.03) + '" fill="' + AV_SKIN + '"/>';
  g += avFace(a.expr, 50, m.cy, m.r);
  g += avHairFront(a, 50, m.cy, m.r, hair);

  const view = o.view || 'full';
  let vb = o.viewBox;
  if (!vb) {
    if (view === 'head') {
      const side = avn(m.r * 3.2);
      vb = avn(50 - side / 2) + ' ' + avn(m.cy - m.r * 1.86) + ' ' + side + ' ' + side;
    } else {
      vb = AV_VIEWBOX;
    }
  }

  return '<svg class="av-svg" viewBox="' + vb + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
    g + '</svg>';
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
    moved: false,
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

    function avSize() {
      const v = parseFloat(layer.style.getPropertyValue('--av'));
      return isFinite(v) && v > 0 ? v : 60;
    }

    /* 전신 캐릭터는 발밑이 (left, top) 지점에 서므로, 머리나 이름표가
       무대 밖으로 잘리지 않도록 캐릭터 키에 맞춰 위치를 제한한다. */
    function clampUV(u, v) {
      const h = root.clientHeight || 1;
      const w = root.clientWidth || 1;
      const yMin = Math.min(0.62, (avSize() * 1.06) / Math.max(1, h));
      const xMin = Math.min(0.28, (avSize() * 0.40) / Math.max(1, w));
      const vert = isVertical();
      if (vert) return { u: clamp(u, yMin, 0.99), v: clamp(v, xMin, 1 - xMin) };
      return { u: clamp(u, xMin, 1 - xMin), v: clamp(v, yMin, 0.99) };
    }

    function ripple(clientX, clientY) {
      const r = root.getBoundingClientRect();
      const d = document.createElement('span');
      d.className = 'tap-ripple';
      d.style.left = avn(clientX - r.left) + 'px';
      d.style.top = avn(clientY - r.top) + 'px';
      root.appendChild(d);
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 640);
    }

    function update(list, opts) {
      lastList = list || lastList;
      lastOpts = opts || lastOpts;
      const vert = isVertical();
      root.classList.toggle('vertical', vert);
      root.classList.toggle('horizontal', !vert);

      const n = lastList.length;
      const base = n >= 30 ? 46 : n >= 24 ? 52 : n >= 16 ? 58 : n >= 9 ? 66 : 78;
      /* 큰 화면(선생님 화면·태블릿)에서는 캐릭터를 더 크게 */
      const box = root.getBoundingClientRect();
      const k = clamp(Math.min(box.width, box.height) / 460, 1, 1.55);
      const size = Math.round(base * k);
      layer.style.setProperty('--av', size + 'px');

      const seen = {};
      lastList.forEach(function (p) {
        seen[p.id] = 1;
        let el = els.get(p.id);
        if (!el) {
          el = document.createElement('div');
          el.className = 'avatar';
          el.innerHTML = '<span class="ring"></span>' +
            '<span class="face"><span class="av-in"></span></span>' +
            '<span class="spk s1">✨</span><span class="spk s2">✨</span><span class="spk s3">✨</span>' +
            '<span class="nm"></span><span class="me-tag">나</span><span class="mk">✨</span>';
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

        const uv = clampUV(p.u, p.v);
        el.style.left = (vert ? uv.v : uv.u) * 100 + '%';
        el.style.top = (vert ? uv.u : uv.v) * 100 + '%';
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
      return clampUV(vert ? py : px, vert ? px : py);
    }

    return {
      root: root,
      update: update,
      toUV: toUV,
      clampUV: clampUV,
      ripple: ripple,
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
    S.moved = false;
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
      hint.textContent = '눌러서 이동 · 끌어도 움직여요';
      hint.classList.toggle('hide', S.moved || S.players.size > 14);
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
    const uv = stuArena.clampUV(u, v);
    S.me.u = uv.u;
    S.me.v = uv.v;
    if (!S.moved) {
      S.moved = true;
      const hint = $('#s-hint');
      if (hint) hint.classList.add('hide');
    }
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
  const AV_VIEW_FOR_TAB = { expr: 'head', hair: 'head', body: 'full', style: 'full' };

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

    /* 학생 무대: 누르기 + 끌기로 이동 */
    const stageEl = stuArena.root;
    let dragging = false;

    function stageMove(e) {
      const uv = stuArena.toUV(e.clientX, e.clientY);
      moveMe(uv.u, uv.v);
    }

    stageEl.addEventListener('pointerdown', function (e) {
      if (S.role !== 'student' || S.phase === 'r') return;
      dragging = true;
      try { stageEl.setPointerCapture(e.pointerId); } catch (er) {}
      stuArena.ripple(e.clientX, e.clientY);
      stageMove(e);
    });
    stageEl.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      if (S.role !== 'student' || S.phase === 'r') { dragging = false; return; }
      if (e.cancelable) e.preventDefault();
      stageMove(e);
    });
    ['pointerup', 'pointercancel'].forEach(function (t) {
      stageEl.addEventListener(t, function () { dragging = false; });
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
