/**
 * 12 维雷达图（Canvas API，移动端自适应）
 */

const LEVEL_RADIUS = { L: 1 / 3, M: 2 / 3, H: 1 };

export function renderRadar(
  canvas,
  dimOrder,
  userLevels,
  dimensionDefs,
  opts = {},
) {
  if (!canvas) return;
  const {
    accent = "#d4a957",
    accentFill = "rgba(212, 169, 87, 0.22)",
    grid = "rgba(255, 255, 255, 0.14)",
    gridStrong = "rgba(255, 255, 255, 0.35)",
    labelColor = "rgba(245, 236, 214, 0.92)",
  } = opts;

  // 自适应：以容器宽度为基准 × devicePixelRatio 高清渲染
  const dpr = window.devicePixelRatio || 1;
  const parent = canvas.parentElement;
  const parentW = parent ? parent.clientWidth : 0;
  const parentH = parent ? parent.clientHeight : 0;
  // 优先读父容器尺寸；canvas 自身 clientWidth 在初次渲染或 display:none 时不可靠
  const rawSize = parentW || canvas.clientWidth || 0;
  const cssSize = Math.max(
    240,
    Math.min(rawSize || 360, 520, window.innerWidth - 48),
  );
  canvas.width = cssSize * dpr;
  canvas.height = cssSize * dpr;
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssSize, cssSize);

  const cx = cssSize / 2;
  const cy = cssSize / 2;
  // 给 label 预留更多空间
  const radius = cssSize / 2 - Math.max(44, cssSize * 0.18);
  const N = dimOrder.length;
  if (N === 0) return;

  // 网格三圈
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  for (let r = 1; r <= 3; r++) {
    const rr = (radius * r) / 3;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
      const x = cx + Math.cos(angle) * rr;
      const y = cy + Math.sin(angle) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // 轴线
  ctx.strokeStyle = grid;
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.stroke();
  }

  // 用户多边形
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    const lv = userLevels[dimOrder[i]] || "M";
    const rr = radius * (LEVEL_RADIUS[lv] ?? 2 / 3);
    const x = cx + Math.cos(angle) * rr;
    const y = cy + Math.sin(angle) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = accentFill;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 顶点：按 L/M/H 区分颜色与大小
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    const lv = userLevels[dimOrder[i]] || "M";
    const rr = radius * (LEVEL_RADIUS[lv] ?? 2 / 3);
    const x = cx + Math.cos(angle) * rr;
    const y = cy + Math.sin(angle) * rr;
    const vertexR = lv === "H" ? 4.5 : lv === "L" ? 3 : 3.5;
    ctx.fillStyle =
      lv === "H" ? accent : lv === "L" ? "#4dd6d0" : "rgba(245,236,214,0.85)";
    ctx.beginPath();
    ctx.arc(x, y, vertexR, 0, Math.PI * 2);
    ctx.fill();
    if (lv === "H") {
      // 外圈高亮环
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, vertexR + 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 标签（不使用 emoji，仅显示维度名称）
  const fontSize = Math.max(10, Math.round(cssSize * 0.036));
  ctx.font = `${fontSize}px -apple-system, "Microsoft YaHei", sans-serif`;
  ctx.fillStyle = labelColor;
  ctx.textBaseline = "middle";
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    const def = dimensionDefs[dimOrder[i]] || { name: dimOrder[i] };
    const label = def.name || dimOrder[i];
    const lx = cx + Math.cos(angle) * (radius + fontSize * 1.1);
    const ly = cy + Math.sin(angle) * (radius + fontSize * 1.1);
    const cos = Math.cos(angle);
    if (cos > 0.2) ctx.textAlign = "left";
    else if (cos < -0.2) ctx.textAlign = "right";
    else ctx.textAlign = "center";

    // 根据等级微调标签颜色（高亮 H 维度，弱化 L）
    const lv = userLevels[dimOrder[i]] || "M";
    if (lv === "H") ctx.fillStyle = accent;
    else if (lv === "L") ctx.fillStyle = "rgba(245, 236, 214, 0.6)";
    else ctx.fillStyle = labelColor;

    ctx.fillText(label, lx, ly);
  }
  ctx.fillStyle = labelColor;

  // 中心点淡色
  ctx.fillStyle = gridStrong;
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
}
