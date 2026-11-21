// 計算無双 UIモック v1（STEP 2）: トップ / ゲーム / 結果 の3画面, 390x844
const C = {
  bg: { r: 0.059, g: 0.090, b: 0.165 },      // #0F172A
  card: { r: 0.118, g: 0.161, b: 0.231 },    // #1E293B
  key: { r: 0.200, g: 0.255, b: 0.333 },     // #334155
  yellow: { r: 1.000, g: 0.780, b: 0.000 },  // #FFC700
  mint: { r: 0.000, g: 0.902, b: 0.463 },    // #00E676
  pink: { r: 1.000, g: 0.090, b: 0.267 },    // #FF1744
  orange: { r: 1.000, g: 0.569, b: 0.000 },  // #FF9100
  white: { r: 0.973, g: 0.980, b: 0.988 },   // #F8FAFC
  gray: { r: 0.580, g: 0.639, b: 0.722 },    // #94A3B8
  dark: { r: 0.059, g: 0.090, b: 0.165 }     // text on yellow
};
let FAMILY = 'Noto Sans JP', REG = 'Regular', BOLD = 'Bold';
try {
  await figma.loadFontAsync({ family: FAMILY, style: REG });
  await figma.loadFontAsync({ family: FAMILY, style: BOLD });
} catch (e) {
  FAMILY = 'Inter'; REG = 'Regular'; BOLD = 'Semi Bold';
  await figma.loadFontAsync({ family: FAMILY, style: REG });
  await figma.loadFontAsync({ family: FAMILY, style: BOLD });
}
function solid(color, opacity) {
  const p = { type: 'SOLID', color: color };
  if (opacity !== undefined) p.opacity = opacity;
  return p;
}
function rect(parent, x, y, w, h, color, radius, strokeColor) {
  const r = figma.createRectangle();
  r.x = x; r.y = y; r.resize(w, h);
  r.fills = color ? [solid(color)] : [];
  if (radius) r.cornerRadius = radius;
  if (strokeColor) { r.strokes = [solid(strokeColor)]; r.strokeWeight = 2; }
  parent.appendChild(r);
  return r;
}
function text(parent, str, x, y, w, size, color, bold, align) {
  const t = figma.createText();
  t.fontName = { family: FAMILY, style: bold ? BOLD : REG };
  t.fontSize = size;
  t.characters = str;
  t.fills = [solid(color)];
  t.textAlignHorizontal = align || 'LEFT';
  t.textAutoResize = 'NONE';
  t.resize(w, Math.ceil(size * 1.5));
  t.x = x; t.y = y;
  parent.appendChild(t);
  return t;
}
function frame(name, x) {
  const f = figma.createFrame();
  f.name = name;
  f.x = x; f.y = 0;
  f.resize(390, 844);
  f.fills = [solid(C.bg)];
  f.clipsContent = true;
  figma.currentPage.appendChild(f);
  return f;
}
figma.currentPage.name = 'モックv1（STEP2）';
const ids = {};

// ---------- 1. トップ ----------
const top = frame('1_トップ', 0);
ids.top = top.id;
text(top, '計算無双', 0, 52, 390, 46, C.white, true, 'CENTER');
text(top, 'けいさん むそう', 0, 108, 390, 14, C.gray, false, 'CENTER');
rect(top, 258, 26, 108, 36, C.card, 18);
text(top, 'ランキング', 258, 34, 108, 13, C.white, true, 'CENTER');
text(top, 'えんざんを えらぼう', 24, 158, 342, 16, C.white, true);
const ops = [['＋', 'たしざん'], ['−', 'ひきざん'], ['×', 'かけざん'], ['÷', 'わりざん'], ['MIX', 'ミックス']];
ops.forEach(function (op, i) {
  const x = 24 + i * 70;
  const sel = i === 0;
  rect(top, x, 190, 62, 58, sel ? C.yellow : C.card, 12);
  text(top, op[0], x, 196, 62, 20, sel ? C.dark : C.white, true, 'CENTER');
  text(top, op[1], x, 224, 62, 10, sel ? C.dark : C.gray, false, 'CENTER');
});
text(top, 'むずかしさ', 24, 272, 342, 16, C.white, true);
const levels = ['Lv.1　しょきゅう', 'Lv.2　ちゅうきゅう', 'Lv.3　じょうきゅう', 'Lv.4　超級', 'Lv.5　無双'];
levels.forEach(function (lv, i) {
  const y = 304 + i * 52;
  const sel = i === 0;
  rect(top, 24, y, 342, 44, sel ? C.yellow : C.card, 12);
  text(top, lv, 40, y + 10, 310, 16, sel ? C.dark : C.white, sel, 'LEFT');
});
text(top, 'じかん', 24, 580, 342, 16, C.white, true);
const times = ['30秒', '60秒', '120秒'];
times.forEach(function (tm, i) {
  const x = 24 + i * 118;
  const sel = i === 1;
  rect(top, x, 612, 106, 48, sel ? C.yellow : C.card, 12);
  text(top, tm, x, 624, 106, 16, sel ? C.dark : C.white, true, 'CENTER');
});
rect(top, 24, 716, 342, 76, C.yellow, 16);
text(top, 'スタート！', 24, 726, 342, 24, C.dark, true, 'CENTER');
text(top, 'たしざん ・ Lv.1 ・ 60びょう', 24, 758, 342, 13, C.dark, false, 'CENTER');

// ---------- 2. ゲーム ----------
const game = frame('2_ゲーム', 470);
ids.game = game.id;
rect(game, 0, 0, 390, 10, C.card, 0);
rect(game, 0, 0, 292, 10, C.mint, 0);
text(game, '残り 45 秒', 0, 26, 390, 28, C.white, true, 'CENTER');
text(game, 'せいかい 12', 24, 78, 150, 15, C.white, true);
text(game, 'ミス 1', 216, 78, 150, 15, C.pink, true, 'RIGHT');
rect(game, 24, 110, 342, 150, C.card, 20);
text(game, '7 × 8 =', 24, 128, 342, 54, C.white, true, 'CENTER');
text(game, '56', 24, 192, 342, 42, C.yellow, true, 'CENTER');
rect(game, 115, 242, 160, 4, C.yellow, 2);
const keys = [
  ['7', 'd'], ['8', 'd'], ['9', 'd'], ['クリア', 'clear'],
  ['4', 'd'], ['5', 'd'], ['6', 'd'], ['パス', 'pass'],
  ['1', 'd'], ['2', 'd'], ['3', 'd'], ['けってい', 'ok'],
  ['0', 'wide'], ['.', 'd']
];
const kx = [24, 112, 200, 288], ky = [292, 378, 464, 550], kw = 78, kh = 76;
keys.forEach(function (k, i) {
  const col = i % 4, row = Math.floor(i / 4);
  if (k[1] === 'wide') {
    rect(game, kx[0], ky[3], 166, kh, C.key, 14);
    text(game, '0', kx[0], ky[3] + 22, 166, 26, C.white, true, 'CENTER');
    return;
  }
  if (k[1] === 'ok') {
    rect(game, kx[3], ky[2], kw, kh * 2 + 10, C.yellow, 14);
    text(game, 'けってい', kx[3], ky[2] + 66, kw, 17, C.dark, true, 'CENTER');
    return;
  }
  if (k[1] === 'd' && row === 3) {
    rect(game, kx[1], ky[3], kw, kh, C.key, 14);
    text(game, '.', kx[1], ky[3] + 22, kw, 26, C.white, true, 'CENTER');
    return;
  }
  const x = kx[col], y = ky[row];
  rect(game, x, y, kw, kh, C.key, 14);
  if (k[1] === 'clear') text(game, 'クリア', x, y + 28, kw, 15, C.orange, true, 'CENTER');
  else if (k[1] === 'pass') text(game, 'パス', x, y + 28, kw, 15, C.gray, true, 'CENTER');
  else text(game, k[0], x, y + 22, kw, 26, C.white, true, 'CENTER');
});
text(game, 'PCでは キーボードでも あそべるよ', 0, 664, 390, 12, C.gray, false, 'CENTER');

// ---------- 3. 結果 ----------
const res = frame('3_結果', 940);
ids.result = res.id;
text(res, 'タイムアップ！', 0, 44, 390, 30, C.white, true, 'CENTER');
rect(res, 45, 100, 300, 96, C.yellow, 16);
text(res, 'ランク', 45, 110, 300, 12, C.dark, false, 'CENTER');
text(res, '閃光の計算将軍', 45, 132, 300, 28, C.dark, true, 'CENTER');
text(res, '8,640 pt', 0, 222, 390, 44, C.white, true, 'CENTER');
text(res, 'NEW RECORD!', 0, 278, 390, 16, C.mint, true, 'CENTER');
const stats = [['正解数', '42 問'], ['ミス数', '2 回'], ['正確率', '95.5 %'], ['平均回答', '1.2 秒/問']];
stats.forEach(function (s, i) {
  const x = 24 + (i % 2) * 177, y = 322 + Math.floor(i / 2) * 96;
  rect(res, x, y, 165, 84, C.card, 14);
  text(res, s[0], x + 16, y + 12, 133, 13, C.gray, false);
  text(res, s[1], x + 16, y + 36, 133, 24, C.white, true);
});
text(res, 'ランキングに とうろく（任意）', 24, 532, 342, 14, C.white, true);
rect(res, 24, 560, 222, 48, C.card, 10);
text(res, 'ニックネーム（最大10文字）', 36, 574, 200, 13, C.gray, false);
rect(res, 258, 560, 108, 48, C.yellow, 10);
text(res, 'とうろく', 258, 572, 108, 16, C.dark, true, 'CENTER');
rect(res, 24, 648, 342, 64, C.yellow, 14);
text(res, 'もう一度あそぶ', 24, 666, 342, 20, C.dark, true, 'CENTER');
rect(res, 24, 728, 342, 56, null, 14, C.gray);
text(res, 'モード選択にもどる', 24, 744, 342, 16, C.white, false, 'CENTER');

return { created: ids, fontUsed: FAMILY };
