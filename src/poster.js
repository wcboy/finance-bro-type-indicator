/**
 * 分享海报生成 v4.1 · 纸质档案风 Canvas
 *
 * 布局策略：上下两端 pin，中段 flow
 *   · 顶部档案号 + CONFIDENTIAL 章（固定）
 *   · Kicker → Dear → CODE → CN 名 → 副标题 → Chips → Roast（从上往下流）
 *   · 雷达 / CP / QR 从下往上 pin 固定位置
 *   · 严格区分 ASCII / CJK 字体栈，避免字形缺失
 *
 * 1080 × 1920 竖屏
 */

import QRCode from "qrcode";

const SITE_URL = "https://wcboy.github.io/finance-bro-type-indicator/";
const LEVEL_RADIUS = { L: 1 / 3, M: 2 / 3, H: 1 };

const IDENTITY_COMPANY = {
  intern: "LUJIAZUI · 实习生池",
  junior: "LUJIAZUI · 初级合伙人",
  senior: "LUJIAZUI · 资深档案库",
};

/* ========== 字体栈：严格区分 ASCII / CJK ========== */
const FONT_MONO = `"JetBrains Mono", "SF Mono", "Courier New", ui-monospace, monospace`;
const FONT_DISPLAY_ASCII = `"Bebas Neue", "Oswald", "Impact", sans-serif`; // 仅 ASCII
const FONT_SERIF_ASCII = `"DM Serif Display", "Playfair Display", Georgia, serif`; // 仅 ASCII
const FONT_CJK_SERIF = `"Noto Serif SC", "Source Han Serif SC", "PingFang SC", "STSong", serif`;
const FONT_CJK_SANS = `"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "Noto Sans SC", sans-serif`;
const FONT_SCRIPT = `"Caveat", "Brush Script MT", cursive`; // 仅 ASCII（手写感英文）

const THEME_NORMAL = {
  bg: "#f1e6c9",
  ink: "#1a140a",
  inkDim: "rgba(26,20,10,0.64)",
  inkMute: "rgba(26,20,10,0.42)",
  rouge: "#c93a3a",
  rougeInk: "#8e1b1b",
  gold: "#d4a24c",
  goldDeep: "#8e6622",
  bull: "#0e8f5a",
  bear: "#c93a3a",
  gridSoft: "rgba(26,20,10,0.18)",
  gridStrong: "rgba(26,20,10,0.42)",
  radarFill: "rgba(201,58,58,0.22)",
  roastBg: "rgba(201,58,58,0.05)",
  roastQuote: "rgba(201,58,58,0.28)",
  bestBg: "rgba(14,143,90,0.1)",
  worstBg: "rgba(201,58,58,0.08)",
};
const THEME_EGG = {
  bg: "#13100a",
  ink: "#f0e4c8",
  inkDim: "rgba(240,228,200,0.72)",
  inkMute: "rgba(240,228,200,0.42)",
  rouge: "#ff9500",
  rougeInk: "#ff6a00",
  gold: "#ffd27a",
  goldDeep: "#b8771f",
  bull: "#00ff88",
  bear: "#ff6a00",
  gridSoft: "rgba(240,228,200,0.15)",
  gridStrong: "rgba(240,228,200,0.35)",
  radarFill: "rgba(255,149,0,0.28)",
  roastBg: "rgba(255,149,0,0.06)",
  roastQuote: "rgba(255,149,0,0.38)",
  bestBg: "rgba(0,255,136,0.1)",
  worstBg: "rgba(255,106,0,0.1)",
};

/* ========== 工具 ========== */

function setFont(ctx, size, weight, family, style = "") {
  const pre = style ? `${style} ` : "";
  ctx.font = `${pre}${weight} ${size}px ${family}`;
}

function wrapLines(ctx, text, maxWidth) {
  const out = [];
  let cur = "";
  for (const ch of String(text)) {
    if (ch === "\n") {
      out.push(cur);
      cur = "";
      continue;
    }
    const test = cur + ch;
    if (ctx.measureText(test).width > maxWidth && cur) {
      out.push(cur);
      cur = ch;
    } else {
      cur = test;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function dashRect(ctx, x, y, w, h, color, dash = [8, 6], lw = 1.5) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.setLineDash(dash);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** 红章：矩形描边 + 文字 */
function drawStamp(ctx, cx, cy, text, color, rotation = 0, fontSize = 30) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  setFont(ctx, fontSize, 700, FONT_DISPLAY_ASCII);
  const w = ctx.measureText(text).width + 28;
  const h = fontSize + 18;
  ctx.globalAlpha = 0.82;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(text, 0, 2);
  ctx.restore();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* ========== 雷达 ========== */

function drawRadar(ctx, cx, cy, radius, dimOrder, levels, defs, theme) {
  const N = dimOrder.length;
  if (!N) return;
  ctx.save();

  // 3 圈网格
  ctx.strokeStyle = theme.gridSoft;
  ctx.lineWidth = 1.2;
  for (let r = 1; r <= 3; r++) {
    const rr = (radius * r) / 3;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = (Math.PI * 2 * i) / N - Math.PI / 2;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  // 轴线
  ctx.strokeStyle = theme.gridStrong;
  ctx.lineWidth = 1;
  for (let i = 0; i < N; i++) {
    const a = (Math.PI * 2 * i) / N - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.stroke();
  }

  // 用户多边形
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const a = (Math.PI * 2 * i) / N - Math.PI / 2;
    const lv = levels[dimOrder[i]] || "M";
    const rr = radius * (LEVEL_RADIUS[lv] ?? 2 / 3);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = theme.radarFill;
  ctx.fill();
  ctx.strokeStyle = theme.rouge;
  ctx.lineWidth = 3;
  ctx.stroke();

  // 顶点
  for (let i = 0; i < N; i++) {
    const a = (Math.PI * 2 * i) / N - Math.PI / 2;
    const lv = levels[dimOrder[i]] || "M";
    const rr = radius * (LEVEL_RADIUS[lv] ?? 2 / 3);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    const vr = lv === "H" ? 8 : lv === "L" ? 5 : 6;
    ctx.fillStyle =
      lv === "H" ? theme.gold : lv === "L" ? theme.bull : theme.rouge;
    ctx.beginPath();
    ctx.arc(x, y, vr, 0, Math.PI * 2);
    ctx.fill();
  }

  // 标签（仅显示维度名称，不使用emoji）
  setFont(ctx, 20, 700, FONT_CJK_SANS);
  ctx.fillStyle = theme.ink;
  ctx.textBaseline = "middle";
  for (let i = 0; i < N; i++) {
    const a = (Math.PI * 2 * i) / N - Math.PI / 2;
    const def = defs[dimOrder[i]] || { name: dimOrder[i] };
    // 移除emoji，只显示维度名称
    const label = def.name || dimOrder[i];
    const lx = cx + Math.cos(a) * (radius + 30);
    const ly = cy + Math.sin(a) * (radius + 30);
    const cos = Math.cos(a);
    if (cos > 0.2) ctx.textAlign = "left";
    else if (cos < -0.2) ctx.textAlign = "right";
    else ctx.textAlign = "center";
    ctx.fillText(label, lx, ly);
  }
  ctx.restore();
}

/* ========== 主渲染 ========== */

export async function renderPoster({
  primary,
  levels,
  identity,
  dimensions,
  mode = "normal",
  portfolio = null,
}) {
  // 等字体加载完再画
  if (document.fonts && document.fonts.ready) {
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch (_) {}
  }

  const isEgg = mode === "egg";
  const theme = isEgg ? THEME_EGG : THEME_NORMAL;

  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  /* ---------- 背景 ---------- */
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);

  // 轻量径向光晕
  const grad = ctx.createRadialGradient(W / 2, 380, 0, W / 2, 380, 700);
  grad.addColorStop(
    0,
    isEgg ? "rgba(255,149,0,0.22)" : "rgba(212,162,76,0.22)",
  );
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 1100);

  // 纸纹 / CRT
  ctx.save();
  if (!isEgg) {
    ctx.fillStyle = "rgba(110,70,20,0.07)";
    for (let i = 0; i < 1400; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const s = Math.random() * 1.4 + 0.3;
      ctx.fillRect(x, y, s, s);
    }
  } else {
    ctx.fillStyle = "rgba(255,149,0,0.05)";
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  }
  ctx.restore();

  // 外双虚线框
  dashRect(ctx, 40, 40, W - 80, H - 80, theme.rougeInk, [14, 10], 2);
  dashRect(
    ctx,
    52,
    52,
    W - 104,
    H - 104,
    isEgg ? "rgba(255,149,0,0.35)" : "rgba(142,27,27,0.35)",
    [4, 6],
    1,
  );

  /* ========== 布局常量 ========== */
  const LEFT = 90;
  const RIGHT = W - 90;
  const CONTENT_W = RIGHT - LEFT;

  /* ========== §1. 顶部档案号 + CONFIDENTIAL 章（固定） ========== */
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = theme.rougeInk;
  setFont(ctx, 24, 700, FONT_MONO);
  const archiveNo = `FILE NO. ${Date.now().toString(36).slice(-6).toUpperCase()}`;
  ctx.fillText(archiveNo, LEFT, 100);

  drawStamp(ctx, RIGHT - 130, 130, "CONFIDENTIAL", theme.rouge, 6, 30);

  let cursorY = 180;

  /* ========== §2. Kicker + 分隔线 ========== */
  ctx.textAlign = "center";
  ctx.fillStyle = theme.rougeInk;
  setFont(ctx, 26, 700, FONT_MONO);
  const kicker = isEgg
    ? "— HIDDEN FILE · 彩蛋档案解锁 —"
    : "— OFFER LETTER · FBTI 档案部 —";
  ctx.fillText(kicker, W / 2, cursorY);
  cursorY += 40;

  ctx.strokeStyle = theme.rougeInk;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 220, cursorY);
  ctx.lineTo(W / 2 + 220, cursorY);
  ctx.stroke();
  cursorY += 24;

  /* ========== §3. "Finance Bro，你是"（拆两段渲染，避开字形缺失） ========== */
  const dearLatin = "Finance Bro";
  const dearCjk = "，你是";

  // 先量测两段宽度用各自字体
  setFont(ctx, 44, 700, FONT_SCRIPT, "italic");
  const wLatin = ctx.measureText(dearLatin).width;
  setFont(ctx, 38, 500, FONT_CJK_SERIF, "italic");
  const wCjk = ctx.measureText(dearCjk).width;
  const gap = 10;
  const totalW = wLatin + gap + wCjk;
  const dearX = W / 2 - totalW / 2;

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = theme.ink;
  // 画英文
  setFont(ctx, 44, 700, FONT_SCRIPT, "italic");
  ctx.fillText(dearLatin, dearX, cursorY);
  // 画中文（字号略小对齐视觉重心）
  setFont(ctx, 38, 500, FONT_CJK_SERIF, "italic");
  ctx.fillText(dearCjk, dearX + wLatin + gap, cursorY + 6);

  cursorY += 72;

  /* ========== §4. CODE 大字（纯 ASCII 字体，放心） ========== */
  const codeText = (primary.code || "FINANCER").toUpperCase();
  let codeSize = 158;
  setFont(ctx, codeSize, 700, FONT_DISPLAY_ASCII);
  while (ctx.measureText(codeText).width > CONTENT_W && codeSize > 72) {
    codeSize -= 6;
    setFont(ctx, codeSize, 700, FONT_DISPLAY_ASCII);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = isEgg ? theme.rouge : theme.ink;
  ctx.fillText(codeText, W / 2, cursorY);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // 金色描边装饰
  ctx.strokeStyle = theme.gold;
  ctx.lineWidth = 2;
  ctx.strokeText(codeText, W / 2, cursorY);
  cursorY += codeSize * 0.96 + 6;

  /* ========== §5. 中文名（CJK 衬线） ========== */
  const cn = primary.cn || "金融人";
  let cnSize = 72;
  setFont(ctx, cnSize, 700, FONT_CJK_SERIF);
  while (ctx.measureText(cn).width > CONTENT_W - 40 && cnSize > 44) {
    cnSize -= 4;
    setFont(ctx, cnSize, 700, FONT_CJK_SERIF);
  }
  ctx.fillStyle = theme.rougeInk;
  ctx.fillText(cn, W / 2, cursorY);
  cursorY += cnSize + 12;

  /* ========== §6. 副标题（斜体 CJK 衬线，最多两行） ========== */
  if (primary.title) {
    setFont(ctx, 32, 500, FONT_CJK_SERIF, "italic");
    ctx.fillStyle = theme.inkDim;
    const titleLines = wrapLines(ctx, primary.title, CONTENT_W - 80).slice(
      0,
      2,
    );
    titleLines.forEach((ln, i) => {
      ctx.fillText(ln, W / 2, cursorY + i * 42);
    });
    cursorY += titleLines.length * 42;
  }
  cursorY += 22;

  /* ========== §7. Chips ========== */
  const chips = [];
  if (isEgg) chips.push({ t: "隐藏档案", bg: theme.rouge, fg: "#111" });
  if (primary.rarity)
    chips.push({
      t: `稀有度 ${primary.rarity}`,
      border: theme.rouge,
      fg: theme.rouge,
    });
  if (!isEgg && primary.similarity != null)
    chips.push({
      t: `匹配 ${primary.similarity}%`,
      border: theme.bull,
      fg: theme.bull,
    });
  if (primary.skill)
    chips.push({
      t: `绝活 · ${primary.skill}`,
      border: theme.gold,
      fg: theme.goldDeep,
    });
  if (primary.difficulty)
    chips.push({
      t: primary.difficulty,
      border: theme.gold,
      fg: theme.goldDeep,
    });

  setFont(ctx, 22, 700, FONT_CJK_SANS);
  const chipPad = 18;
  const chipGap = 12;
  const chipH = 44;
  const widths = chips.map((c) => ctx.measureText(c.t).width + chipPad * 2);
  // 自动换行
  const rows = [];
  let row = [];
  let rowW = 0;
  chips.forEach((c, i) => {
    const w = widths[i];
    if (row.length && rowW + chipGap + w > CONTENT_W) {
      rows.push({ items: row, totalW: rowW });
      row = [c];
      rowW = w;
    } else {
      if (row.length) rowW += chipGap;
      row.push(c);
      rowW += w;
    }
  });
  if (row.length) rows.push({ items: row, totalW: rowW });

  rows.forEach((r, rowIdx) => {
    let cxp = W / 2 - r.totalW / 2;
    r.items.forEach((c) => {
      const idx = chips.indexOf(c);
      const w = widths[idx];
      if (c.bg) {
        ctx.fillStyle = c.bg;
        roundRect(ctx, cxp, cursorY, w, chipH, 22);
        ctx.fill();
      }
      if (c.border) {
        ctx.strokeStyle = c.border;
        ctx.lineWidth = 2;
        roundRect(ctx, cxp, cursorY, w, chipH, 22);
        ctx.stroke();
      }
      ctx.fillStyle = c.fg;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(c.t, cxp + w / 2, cursorY + chipH / 2 + 1);
      cxp += w + chipGap;
    });
    cursorY += chipH + (rowIdx < rows.length - 1 ? 12 : 0);
  });
  cursorY += 40;

  /* ========== §8. Roast 引用框（CJK 衬线，非 Caveat） ========== */
  // 先量测行数（最多 3 行，超出截断，避免与雷达区冲突）
  const roast = primary.roast || `你被归档为「${cn}」。`;
  const roastFontSize = 30;
  const roastLineH = 46;
  const roastMaxLines = 3;
  setFont(ctx, roastFontSize, 500, FONT_CJK_SERIF);
  const roastLinesAll = wrapLines(ctx, roast, CONTENT_W - 100);
  let roastLines = roastLinesAll.slice(0, roastMaxLines);
  if (roastLinesAll.length > roastMaxLines) {
    let last = roastLines[roastMaxLines - 1];
    while (
      last.length > 0 &&
      ctx.measureText(last + "…").width > CONTENT_W - 100
    ) {
      last = last.slice(0, -1);
    }
    roastLines[roastMaxLines - 1] = last + "…";
  }

  const boxPadY = 30;
  const boxPadL = 70;
  const boxPadR = 30;
  const boxH = boxPadY * 2 + roastLines.length * roastLineH;
  const boxX = LEFT;
  const boxY = cursorY;

  // 底色
  ctx.fillStyle = theme.roastBg;
  roundRect(ctx, boxX, boxY, CONTENT_W, boxH, 4);
  ctx.fill();
  // 左红竖线
  ctx.fillStyle = theme.rouge;
  ctx.fillRect(boxX, boxY, 8, boxH);

  // 装饰左引号
  ctx.save();
  ctx.fillStyle = theme.roastQuote;
  setFont(ctx, 150, 700, FONT_SERIF_ASCII);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText('"', boxX + 22, boxY - 16);
  ctx.restore();

  // 正文
  ctx.fillStyle = theme.ink;
  setFont(ctx, roastFontSize, 500, FONT_CJK_SERIF);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  roastLines.forEach((ln, i) => {
    ctx.fillText(ln, boxX + boxPadL, boxY + boxPadY + i * roastLineH);
  });

  cursorY = boxY + boxH + 26;

  /* ========== §9. 雷达（从上往下 flow） ========== */
  // 雷达小标题
  setFont(ctx, 22, 700, FONT_MONO);
  ctx.fillStyle = theme.rougeInk;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("— 12 维人格画像 · RADAR —", W / 2, cursorY);
  cursorY += 34;

  const RADAR_R = 170;
  const RADAR_LABEL_PAD = 38; // 标签外扩空间
  const radarCX = W / 2;
  const radarCY = cursorY + RADAR_LABEL_PAD + RADAR_R;
  drawRadar(
    ctx,
    radarCX,
    radarCY,
    RADAR_R,
    dimensions.order,
    levels,
    dimensions.definitions,
    theme,
  );
  cursorY = radarCY + RADAR_R + RADAR_LABEL_PAD + 18;

  /* ========== §10. CP 双栏 ========== */
  const cpGap = 36;
  const cpCardW = (CONTENT_W - cpGap) / 2;
  const CP_H = 130;
  const cpY = cursorY;

  // —— 左：BEST ——
  const leftX = LEFT;
  ctx.save();
  ctx.fillStyle = theme.bestBg;
  roundRect(ctx, leftX, cpY, cpCardW, CP_H, 8);
  ctx.fill();
  ctx.strokeStyle = theme.bull;
  ctx.lineWidth = 2;
  roundRect(ctx, leftX, cpY, cpCardW, CP_H, 8);
  ctx.stroke();

  setFont(ctx, 18, 700, FONT_MONO);
  ctx.fillStyle = theme.bull;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("BEST CP", leftX + 20, cpY + 18);
  // 中文小标
  setFont(ctx, 16, 700, FONT_CJK_SANS);
  ctx.fillText("· 最佳拍档", leftX + 20 + 110, cpY + 21);

  // 对象名
  let bestName = primary.bestMatch || "—";
  let bestSize = 36;
  setFont(ctx, bestSize, 700, FONT_CJK_SERIF);
  while (ctx.measureText(bestName).width > cpCardW - 40 && bestSize > 22) {
    bestSize -= 2;
    setFont(ctx, bestSize, 700, FONT_CJK_SERIF);
  }
  ctx.fillStyle = theme.ink;
  ctx.fillText(bestName, leftX + 20, cpY + 56);

  setFont(ctx, 15, 500, FONT_CJK_SANS);
  ctx.fillStyle = theme.inkDim;
  ctx.fillText("茶水间能聊到深夜", leftX + 20, cpY + CP_H - 32);
  ctx.restore();

  // —— 右：WORST ——
  const rightX = LEFT + cpCardW + cpGap;
  ctx.save();
  ctx.fillStyle = theme.worstBg;
  roundRect(ctx, rightX, cpY, cpCardW, CP_H, 8);
  ctx.fill();
  ctx.strokeStyle = theme.rouge;
  ctx.lineWidth = 2;
  roundRect(ctx, rightX, cpY, cpCardW, CP_H, 8);
  ctx.stroke();

  setFont(ctx, 18, 700, FONT_MONO);
  ctx.fillStyle = theme.rouge;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("WORST CP", rightX + 20, cpY + 18);
  setFont(ctx, 16, 700, FONT_CJK_SANS);
  ctx.fillText("· 死对头", rightX + 20 + 120, cpY + 21);

  let worstName = primary.worstMatch || "—";
  let worstSize = 36;
  setFont(ctx, worstSize, 700, FONT_CJK_SERIF);
  while (ctx.measureText(worstName).width > cpCardW - 40 && worstSize > 22) {
    worstSize -= 2;
    setFont(ctx, worstSize, 700, FONT_CJK_SERIF);
  }
  ctx.fillStyle = theme.ink;
  ctx.fillText(worstName, rightX + 20, cpY + 56);

  setFont(ctx, 15, 500, FONT_CJK_SANS);
  ctx.fillStyle = theme.inkDim;
  ctx.fillText("合规会上必吵起来", rightX + 20, cpY + CP_H - 32);
  ctx.restore();

  cursorY = cpY + CP_H + 28;

  /* ========== §10.5 投资账户结算（有 portfolio 数据才画）========== */
  if (portfolio) {
    const pnlBoxH = 130;
    const pnlY = cursorY;
    const gain = (portfolio.returnPct || 0) >= 0;
    const accentColor = gain ? "#c93a3a" : "#0a8f87"; // 红涨绿跌
    // 外框
    ctx.strokeStyle = theme.rougeInk;
    ctx.lineWidth = 1.5;
    roundRect(ctx, LEFT, pnlY, W - 2 * LEFT, pnlBoxH, 14);
    ctx.stroke();

    // 标题
    setFont(ctx, 18, 700, FONT_MONO);
    ctx.fillStyle = theme.rougeInk;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const titleText = "— 投资账户结算 · P&L —";
    // 画标题外框（盖在虚线上）
    const titleW = ctx.measureText(titleText).width + 24;
    ctx.fillStyle = theme.bg;
    ctx.fillRect(W / 2 - titleW / 2, pnlY - 10, titleW, 20);
    ctx.fillStyle = theme.rougeInk;
    ctx.fillText(titleText, W / 2, pnlY - 9);

    // 左栏：账户净值（大字）+ 收益率
    const leftColX = LEFT + 32;
    setFont(ctx, 14, 600, FONT_MONO);
    ctx.fillStyle = theme.inkDim;
    ctx.textAlign = "left";
    ctx.fillText("FINAL VALUE", leftColX, pnlY + 22);

    setFont(ctx, 40, 800, FONT_DISPLAY_ASCII);
    ctx.fillStyle = theme.ink;
    const finalValStr = "¥" + Math.round(portfolio.finalValue || 0).toLocaleString("en-US");
    ctx.fillText(finalValStr, leftColX, pnlY + 40);

    setFont(ctx, 24, 800, FONT_DISPLAY_ASCII);
    ctx.fillStyle = accentColor;
    const pctStr =
      (portfolio.returnPct >= 0 ? "+" : "") +
      (portfolio.returnPct || 0).toFixed(2) +
      "%";
    ctx.fillText(pctStr, leftColX, pnlY + 86);

    // 右栏：初始 / 峰值 / 操作
    const rightColX = W - LEFT - 280;
    setFont(ctx, 13, 600, FONT_MONO);
    ctx.fillStyle = theme.inkDim;
    ctx.textAlign = "left";
    ctx.fillText("INITIAL", rightColX, pnlY + 22);
    ctx.fillText("PEAK", rightColX + 110, pnlY + 22);
    ctx.fillText("OPS", rightColX + 210, pnlY + 22);

    setFont(ctx, 18, 700, FONT_DISPLAY_ASCII);
    ctx.fillStyle = theme.ink;
    ctx.fillText(
      "¥" + Math.round(portfolio.initialCash || 30000).toLocaleString("en-US"),
      rightColX,
      pnlY + 44,
    );
    ctx.fillText(
      "¥" + Math.round(portfolio.peakValue || 0).toLocaleString("en-US"),
      rightColX + 110,
      pnlY + 44,
    );
    ctx.fillText(String(portfolio.tradeCount || 0), rightColX + 210, pnlY + 44);

    // 右栏底部小评：根据涨跌定短 label
    setFont(ctx, 15, 700, FONT_CJK_SANS);
    ctx.fillStyle = accentColor;
    const ribbon =
      portfolio.returnPct >= 30
        ? "高光时刻"
        : portfolio.returnPct >= 5
          ? "稳步上扬"
          : portfolio.returnPct >= 0
            ? "小幅盈利"
            : portfolio.returnPct >= -10
              ? "温和回调"
              : portfolio.returnPct >= -20
                ? "账户承压"
                : "爆仓预警";
    ctx.fillText(ribbon, rightColX, pnlY + 86);

    cursorY = pnlY + pnlBoxH + 30;
  }

  /* ========== §11. QR + 分享信息（最底） ========== */
  const qrSize = 174;
  const qrX = LEFT;
  const qrY = cursorY;

  try {
    const qrDataUrl = await QRCode.toDataURL(SITE_URL, {
      width: qrSize,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1a140a", light: "#ffffff" },
    });
    const qrImg = await loadImage(qrDataUrl);
    // 白底卡片（微信压暗保护）
    ctx.fillStyle = "#fff";
    roundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 6);
    ctx.fill();
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  } catch (e) {
    console.warn("QR 生成失败", e);
  }

  // 右侧文案（移除"FINANCE / TI"大字后上方布局收紧）
  const textX = qrX + qrSize + 32;
  setFont(ctx, 20, 700, FONT_MONO);
  ctx.fillStyle = theme.rougeInk;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("SCAN · 扫码附身", textX, qrY + 2);

  setFont(ctx, 17, 500, FONT_MONO);
  ctx.fillStyle = theme.inkDim;
  ctx.fillText("wcboy.github.io/finance-bro-type-indicator", textX, qrY + 36);

  setFont(ctx, 18, 700, FONT_CJK_SANS);
  ctx.fillStyle = theme.rouge;
  ctx.fillText(
    IDENTITY_COMPANY[identity] || IDENTITY_COMPANY.junior,
    textX,
    qrY + 66,
  );

  setFont(ctx, 28, 700, FONT_SCRIPT, "italic");
  ctx.fillStyle = theme.gold;
  const hashAscii = "#FBTI";
  const hashAsciiW = ctx.measureText(hashAscii).width;
  ctx.fillText(hashAscii, textX, qrY + 100);
  setFont(ctx, 22, 700, FONT_CJK_SANS);
  ctx.fillStyle = theme.gold;
  ctx.fillText("#金融人刻板印象测试", textX + hashAsciiW + 14, qrY + 108);

  // 页脚
  setFont(ctx, 16, 500, FONT_MONO);
  ctx.fillStyle = theme.inkMute;
  ctx.textAlign = "center";
  ctx.fillText("仅供娱乐 · 不构成投资或职业建议 · 盈亏自负", W / 2, H - 60);

  return canvas.toDataURL("image/png");
}
