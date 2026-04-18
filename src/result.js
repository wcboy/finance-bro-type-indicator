/**
 * 结果页渲染 · Story 竖屏卡片流版本（v4）
 * 把 result/levels/identity 展开到 6 张 Story 卡片
 */

import { renderRadar } from "./chart.js";

function byId(id) {
  return document.getElementById(id);
}
function setText(el, v) {
  if (el) el.textContent = v ?? "";
}

/** 身份中文 + 讽刺公司名 */
const IDENTITY_META = {
  intern: { cn: "在校生/实习中", company: "Finance Bro TI · 实习候选人池" },
  junior: { cn: "工作1-3年", company: "Finance Bro TI · 初级打工人档案" },
  senior: { cn: "工作3年以上", company: "Finance Bro TI · 资深从业者档案" },
};

/** Hero 卡 kicker 文案（根据 mode） */
const KICKER_BY_MODE = {
  normal: "RARITY · 稀有度",
  fallback: "UNCLASSIFIED · 未能归档",
  egg: "HIDDEN FILE · 彩蛋档案",
};

/** 根据收益率与操作次数生成评语（portfolio 版）*/
function getPortfolioComment(returnPct, tradeCount, holdCount) {
  const opsHint =
    tradeCount === 0 && holdCount === 0
      ? "全程没动一下，纯 beta 打法。"
      : tradeCount >= 12
        ? `${tradeCount} 次买卖，手还是太痒了。`
        : tradeCount <= 2
          ? "佛系打法，交给时间。"
          : "";
  if (returnPct >= 30) {
    return `巴菲特看了都想加你微信。${opsHint}`;
  } else if (returnPct >= 15) {
    return `决策逻辑接近专业 PM 水平。${opsHint}`;
  } else if (returnPct >= 5) {
    return `稳健型选手，适合做固收研究员。${opsHint}`;
  } else if (returnPct >= 0) {
    return `勉强跑赢余额宝。${opsHint}`;
  } else if (returnPct >= -10) {
    return `这波操作……市场有风险，你也有风险。${opsHint}`;
  } else if (returnPct >= -20) {
    return `触发证监会异常交易监控预警。${opsHint}`;
  } else {
    return `账户已被标记为「反向指标」候选。${opsHint}`;
  }
}

/** 千分位 */
function fmtMoney(n) {
  if (!isFinite(n)) return "—";
  return "¥" + Math.round(n).toLocaleString("en-US");
}

/** 计算K线收益数据 */
function calculateKlineStats(klineData) {
  const { basePrice, candles, prices } = klineData;
  if (!candles || candles.length === 0) {
    return null;
  }

  // 最终净值
  const finalPrice = candles[candles.length - 1]?.close || basePrice;

  // 收益率
  const returnRate = ((finalPrice - basePrice) / basePrice) * 100;

  // 计算最大回撤
  let maxPrice = basePrice;
  let maxDrawdown = 0;
  for (const candle of candles) {
    maxPrice = Math.max(maxPrice, candle.high);
    const drawdown = ((maxPrice - candle.low) / maxPrice) * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  // 计算夏普比率（简化版：收益/波动）
  const returns = [];
  for (let i = 1; i < prices.length && i <= candles.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length > 0 ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length : 0;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(30) : 0; // 年化

  return {
    basePrice,
    finalPrice,
    returnRate,
    maxDrawdown,
    sharpe,
  };
}

export function renderResult({
  result,
  levels,
  identity,
  dimensions,
  types,
  interpretations,
  config,
  klineData,
}) {
  const { primary, secondary, rankings, mode = "normal", egg = null } = result || {};
  if (!primary) return;

  const isEgg = mode === "egg";
  const isFallback = mode === "fallback";

  // ============ Story 1 · 封面 Offer Letter ============
  const identityMeta = IDENTITY_META[identity] || IDENTITY_META.junior;
  setText(byId("cover-identity-cn"), primary.cn || primary.code);

  // cover 简述：egg 模式下把"附加身份"写在主人格之后，不再覆盖主人格
  const briefText = isEgg && egg
    ? `你的主档案是「${primary.cn}」——但系统在档案柜底层发现了一个印着你名字的抽屉：「${egg.cn}」。真实的你，在这两层之间。`
    : isFallback
      ? `你的答案跳出了我司标准档案模板。本部门判定你为：${primary.cn}。请保持这份独特，或重测一次看看。`
      : primary.intro || "";
  setText(byId("cover-body-brief"), briefText);

  setText(byId("cover-company"), identityMeta.company);

  const coverKicker = byId("cover-kicker");
  if (coverKicker) {
    coverKicker.textContent = isEgg
      ? "— HIDDEN FILE · 彩蛋档案已解锁 —"
      : "— 测试结果 · Finance Bro 档案 —";
  }

  // ============ Story 2 · Hero 代号大字报 ============
  const story2 = byId("story-2");
  if (story2) story2.dataset.mode = isEgg ? "egg" : "normal";

  // rarity 展示
  const rarityText = primary.rarity || "—";
  const heroRarityEl = byId("hero-rarity");
  if (heroRarityEl) {
    if (heroRarityEl.parentElement?.firstChild) {
      heroRarityEl.parentElement.firstChild.textContent = `${KICKER_BY_MODE[mode]} `;
    }
    heroRarityEl.textContent = rarityText;
  }

  setText(byId("hero-code"), primary.code || "—");
  setText(byId("hero-cn"), primary.cn || "");
  setText(byId("hero-title"), primary.title || "");

  // Chips
  const chipsWrap = byId("hero-chips");
  if (chipsWrap) {
    chipsWrap.innerHTML = "";
    if (isEgg) {
      chipsWrap.appendChild(makeChip("隐藏档案", "chip-egg"));
    }
    if (primary.rarity) {
      chipsWrap.appendChild(makeChip(`稀有度 ${primary.rarity}`, "chip-rare"));
    }
    if (!isEgg && primary.similarity != null) {
      chipsWrap.appendChild(
        makeChip(`匹配 ${primary.similarity}%`, "chip-skill"),
      );
    }
    if (primary.skill) {
      chipsWrap.appendChild(makeChip(`绝活 · ${primary.skill}`, "chip-skill"));
    }
    if (primary.difficulty) {
      chipsWrap.appendChild(makeChip(primary.difficulty, "chip-diff"));
    }
  }

  // ============ Story 3 · Roast 金句 + 彩蛋附加段 ============
  const roastQuote =
    primary.roast ||
    `你被归档为「${primary.cn}」。我方暂时没有更刻薄的话要说。`;
  setText(byId("roast-quote"), roastQuote);
  setText(byId("roast-desc"), primary.desc || "");

  // 彩蛋附加段：只在 egg 模式且 result.egg 存在时显示；不替换主人格 desc
  const eggInsert = byId("egg-insert");
  if (eggInsert) {
    if (isEgg && egg && egg.note) {
      eggInsert.hidden = false;
      setText(byId("egg-insert-label"), `HIDDEN FILE · ${egg.cn || ""}`);
      setText(byId("egg-insert-intro"), egg.intro || "");
      setText(byId("egg-insert-note"), egg.note);
    } else {
      eggInsert.hidden = true;
    }
  }

  // ============ Story 4 · 12 维雷达 + 维度详情 ============
  requestAnimationFrame(() => {
    renderRadar(
      byId("radar-chart"),
      dimensions.order,
      levels,
      dimensions.definitions,
      {
        accent: "#c93a3a",
        accentFill: "rgba(201, 58, 58, 0.18)",
        grid: "rgba(26, 20, 10, 0.22)",
        gridStrong: "rgba(26, 20, 10, 0.5)",
        labelColor: "rgba(26, 20, 10, 0.82)",
      },
    );
  });

  // 12 维度详情列表
  const dimsWrap = byId("dimensions-detail");
  if (dimsWrap) {
    dimsWrap.innerHTML = "";
    for (const dim of dimensions.order) {
      const def = dimensions.definitions[dim] || {};
      const lv = levels[dim] || "M";
      const row = document.createElement("div");
      row.className = "dim-row";
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = def.name || dim;
      const nameSmall = document.createElement("small");
      nameSmall.textContent = dim;
      name.appendChild(nameSmall);
      const level = document.createElement("span");
      level.className = `level lvl-${lv}`;
      level.textContent = lv === "H" ? "拉满" : lv === "L" ? "摆烂" : "平衡";
      row.append(name, level);
      dimsWrap.appendChild(row);
    }
  }

  // ============ Story 5 · 办公室 CP + 金融直觉收益 ============
  setText(byId("cp-best-name"), primary.bestMatch || "—");
  setText(byId("cp-worst-name"), primary.worstMatch || "—");

  // 投资账户结算：优先用真实 portfolio summary；旧历史记录（无 portfolio）退回合成 K 线统计
  const portfolio = result?.portfolio || null;
  const returnEl = byId("kline-return");
  const returnSubEl = byId("kline-return-sub");

  if (portfolio) {
    const { finalValue, returnPct, peakValue, tradeCount, holdCount, initialCash } = portfolio;
    if (returnEl) {
      returnEl.textContent = fmtMoney(finalValue);
      returnEl.className = `kline-value ${returnPct >= 0 ? "positive" : "negative"}`;
    }
    if (returnSubEl) {
      const sign = returnPct >= 0 ? "+" : "";
      returnSubEl.textContent = `${sign}${returnPct.toFixed(2)}%`;
    }
    setText(byId("kline-drawdown"), fmtMoney(peakValue));
    const ops = tradeCount + (holdCount ? ` · ${holdCount}持仓` : "");
    setText(byId("kline-sharpe"), `${tradeCount} 次${holdCount ? ` +${holdCount}` : ""}`);
    setText(byId("kline-comment"), getPortfolioComment(returnPct, tradeCount, holdCount));
  } else {
    // 兼容：旧历史记录无 portfolio 字段 → 退回合成统计，但 UI 语义仍用 "账户净值" 框架
    const klineStats = calculateKlineStats(klineData || {});
    if (klineStats) {
      const pct = klineStats.returnRate;
      const synthFinal = 30000 * (1 + pct / 100);
      if (returnEl) {
        returnEl.textContent = fmtMoney(synthFinal);
        returnEl.className = `kline-value ${pct >= 0 ? "positive" : "negative"}`;
      }
      if (returnSubEl) {
        returnSubEl.textContent = (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
      }
      setText(byId("kline-drawdown"), fmtMoney(synthFinal * (1 + klineStats.maxDrawdown / 100)));
      setText(byId("kline-sharpe"), "—");
      setText(byId("kline-comment"), getPortfolioComment(pct, 0, 0));
    }
  }

  // ============ Story 6 · TOP 5 + 分享 ============
  const topList = byId("top-list");
  if (topList && Array.isArray(rankings)) {
    topList.innerHTML = "";
    const top = rankings.slice(0, 5);
    top.forEach((t, idx) => {
      const item = document.createElement("div");
      item.className = `top-item top-${idx + 1}`;
      const rank = document.createElement("div");
      rank.className = "rank";
      rank.textContent = `#${idx + 1}`;
      const body = document.createElement("div");
      body.className = "body";
      const title = document.createElement("div");
      title.className = "title-row";
      title.textContent = `${t.cn || t.code}`;
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `${t.code} · ${t.title || ""}`.slice(0, 40);
      body.append(title, meta);
      const score = document.createElement("div");
      score.className = "score";
      score.textContent = `${t.similarity ?? 0}%`;
      item.append(rank, body, score);
      topList.appendChild(item);
    });
  }

  // 免责声明
  setText(byId("disclaimer"), config.display?.disclaimer || "");
  setText(byId("fun-note"), config.display?.funNote || "");
}

function makeChip(text, extra = "") {
  const c = document.createElement("span");
  c.className = `chip ${extra}`.trim();
  c.textContent = text;
  return c;
}
