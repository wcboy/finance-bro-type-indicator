/**
 * FBTI v4 · 入口
 * Finance Bro Type Indicator — ticker + 盖章尽调 + Story 竖屏结果流
 */

import { setText, throttle } from "./utils.js";
import {
  calcDimensionScores,
  countDimensionHits,
  scoresToLevels,
  determineResult,
} from "./engine.js";
import { createQuiz } from "./quiz.js";
import { renderResult } from "./result.js";
import { renderRadar } from "./chart.js";
import "./style.css";

// 静态导入数据，Vite 打包 tree-shake
import questions from "../data/questions.json";
import dimensions from "../data/dimensions.json";
import types from "../data/types.json";
import config from "../data/config.json";
import cognitive from "../data/interpretations/cognitive.json";
import behavioral from "../data/interpretations/behavioral.json";
import social from "../data/interpretations/social.json";

function byId(id) {
  return document.getElementById(id);
}

function showPage(name) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  byId(`page-${name}`).classList.add("active");
  window.scrollTo({
    top: 0,
    behavior: "instant" in window ? "instant" : "auto",
  });

  // 首页隐藏 ticker，答题/结果页显示
  const ticker = byId("ticker-bar");
  if (ticker) ticker.hidden = name === "intro";
}

/** 用 config.display.ticker 填充滚动条（复制两份保证无缝） */
function initTicker() {
  const track = byId("ticker-track");
  if (!track) return;
  const lines = config.display?.ticker || [];
  const frag = document.createDocumentFragment();
  for (let round = 0; round < 2; round++) {
    lines.forEach((raw) => {
      const span = document.createElement("span");
      const up = /▲|\+/.test(raw);
      const down = /▼|-/.test(raw);
      span.textContent = raw;
      if (up) span.classList.add("up");
      else if (down) span.classList.add("down");
      frag.appendChild(span);
    });
  }
  track.appendChild(frag);
}

/**
 * 典型人设预告轮播
 * - 从 types.standard 抽 6 个，每 3.5s 切换一次
 * - 展示：代号 + 中文名 + roast 金句
 * - respect prefers-reduced-motion（减速到 7s）
 */
function initPreviewCarousel() {
  const card = byId("preview-card");
  const codeEl = byId("preview-code");
  const cnEl = byId("preview-cn");
  const roastEl = byId("preview-roast");
  const dotsWrap = byId("preview-dots");
  if (!card || !codeEl) return;

  // 随机抽 6 个，先 shuffle 一次保持稳定
  const pool = (types.standard || []).slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picks = pool.slice(0, 6);
  if (picks.length === 0) return;

  // 生成圆点
  dotsWrap.innerHTML = "";
  picks.forEach((_, i) => {
    const d = document.createElement("span");
    d.className = "dot" + (i === 0 ? " active" : "");
    dotsWrap.appendChild(d);
  });
  const dots = dotsWrap.querySelectorAll(".dot");

  function paint(idx) {
    const p = picks[idx];
    codeEl.textContent = p.code || "—";
    cnEl.textContent = p.cn || "";
    roastEl.textContent = p.roast || p.intro || "";
    card.classList.remove("fading");
    void card.offsetWidth; // trigger reflow
    card.classList.add("fading");
    dots.forEach((d, i) => d.classList.toggle("active", i === idx));
  }

  paint(0);
  const interval = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 7000
    : 3500;
  let cur = 0;
  setInterval(() => {
    cur = (cur + 1) % picks.length;
    // 仅在首页活动时推进（不浪费）
    if (!byId("page-intro").classList.contains("active")) return;
    paint(cur);
  }, interval);
}

/**
 * 横向滚动图片区域
 * - 从 data/FrontImage/seprated/ 加载图片
 * - 复制两份实现无缝循环滚动
 */
function initImageMarquee() {
  const track = byId("marquee-track");
  if (!track) return;

  // 图片列表
  const images = [
    "slide-1.png",
    "slide-2.png",
    "slide-3.png",
    "slide-4.png",
    "slide-5.png",
    "slide-6.png",
    "slide-7.png",
    "slide-8.png",
  ];

  const basePath = "data/FrontImage/seprated/";

  // 清空并创建图片元素（复制两份实现无缝循环）
  track.innerHTML = "";

  for (let round = 0; round < 2; round++) {
    images.forEach((imgName) => {
      const img = document.createElement("img");
      img.src = basePath + imgName;
      img.alt = "FBTI 人格展示";
      img.loading = "lazy";
      track.appendChild(img);
    });
  }
}

/**
 * 构建 K 线蜡烛进度（真实引擎 v7 - A股风格 + 强随机性）
 *
 * 核心逻辑：
 * - 每根蜡烛有开盘价和收盘价
 * - 蜡烛位置基于价格在整体范围内的位置
 * - 红涨绿跌（A股惯例）
 * - 强随机性：即便相同选项，每次K线都不同
 *
 * 随机因素：
 * 1. 初始价格 45-55 随机
 * 2. 市场情绪 -1 到 1 随机（整体偏多/空）
 * 3. 波动率倍数 0.7-1.5 随机
 * 4. 影线长度随机
 * 5. 趋势惯性（连续涨/跌有惯性）
 * 6. 黑天鹅事件 5% 概率大幅波动
 */
function renderCandleProgress(total, currentIdx, answerHistory = [], smartChoiceSequence = [], priceState = null) {
  const wrap = byId("candle-progress");
  if (!wrap) return { basePrice: 50, prices: [50], candles: [] };

  // 初始化价格状态（每次测试都不同）
  if (!priceState) {
    priceState = {
      basePrice: 45 + Math.random() * 10,  // 45-55 随机起始价
      meanPrice: 50,
      prices: [],
      candles: [],
      momentum: 0,
      // 全局随机参数（整个测试周期内保持）
      marketSentiment: (Math.random() - 0.5) * 2,  // -1 到 1，市场整体情绪
      volatilityBase: 0.7 + Math.random() * 0.8,   // 0.7-1.5 波动率基数
      trendInertia: Math.random() * 0.3,            // 0-0.3 趋势惯性系数
    };
  }

  // 初始化 DOM
  if (wrap.children.length !== total) {
    wrap.innerHTML = "";
    for (let i = 0; i < total; i++) {
      const c = document.createElement("div");
      c.className = "candle";
      c.innerHTML = '<div class="candle-wick"></div><div class="candle-body"></div>';
      wrap.appendChild(c);
    }
  }

  const children = wrap.children;
  const candles = priceState.candles.slice();

  // 计算当前价格
  let currentPrice = priceState.basePrice;
  for (let i = 0; i < candles.length; i++) {
    currentPrice = candles[i].close;
  }

  // 计算新增蜡烛
  while (candles.length < answerHistory.length) {
    const history = answerHistory[candles.length];
    const smartChoice = smartChoiceSequence[candles.length] || 2;

    // 开盘价 = 上一根收盘价 + 小幅跳空（随机）
    const gapPercent = (Math.random() - 0.5) * 0.02;  // -1% 到 1% 跳空
    const open = candles.length > 0
      ? currentPrice * (1 + gapPercent)
      : currentPrice;
    let close = open;
    let high = open;
    let low = open;

    if (history) {
      const val = history.value;
      const meanPrice = priceState.meanPrice;
      const deviation = currentPrice - meanPrice;

      // === 随机参数（每题不同）===
      const localRandom = Math.random();
      const localVolatility = priceState.volatilityBase * (0.5 + Math.random());  // 本题波动倍数
      const localBias = (Math.random() - 0.5) * 4;  // 本题随机偏移

      // === 聪明决策影响 ===
      const diff = Math.abs(val - smartChoice);
      let decisionDelta = 0;

      if (diff === 0) {
        // 选对：大概率涨，但涨幅随机
        decisionDelta = (4 + Math.random() * 10) * localVolatility;
        // 小概率"利好出尽是利空"
        if (localRandom > 0.85) {
          decisionDelta = -decisionDelta * 0.3;
        }
      } else if (diff === 1) {
        // 差一档：不确定方向
        decisionDelta = (Math.random() - 0.45) * 10 * localVolatility;
      } else {
        // 选错：大概率跌，但跌幅随机
        decisionDelta = -(4 + Math.random() * 10) * localVolatility;
        // 小概率"利空出尽是利好"
        if (localRandom > 0.88) {
          decisionDelta = -decisionDelta * 0.3;
        }
      }

      // === 市场情绪影响 ===
      const sentimentImpact = priceState.marketSentiment * (1 + Math.random()) * 1.5;

      // === 趋势惯性 ===
      // 计算最近3根蜡烛的趋势
      let recentTrend = 0;
      if (candles.length >= 3) {
        for (let i = candles.length - 3; i < candles.length; i++) {
          recentTrend += candles[i].close - candles[i].open;
        }
        recentTrend /= 3;
      }
      const inertiaImpact = recentTrend * priceState.trendInertia * (0.5 + Math.random());

      // === 均值回归 ===
      const meanReversion = -deviation * (0.03 + Math.random() * 0.05);

      // === 黑天鹅事件（5% 概率）===
      let blackSwan = 0;
      if (Math.random() > 0.95) {
        blackSwan = (Math.random() > 0.5 ? 1 : -1) * (8 + Math.random() * 12);
      }

      // === 综合计算 delta ===
      let delta = decisionDelta + sentimentImpact + inertiaImpact + meanReversion + localBias + blackSwan;

      // === 限制波动（但保留大波动可能）===
      const maxDelta = 18 + Math.random() * 6;  // 18-24 最大波动
      delta = Math.max(-maxDelta, Math.min(maxDelta, delta));

      // === 计算收盘价 ===
      close = Math.max(12, Math.min(88, open + delta));

      // === 影线（强随机）===
      const bodySize = Math.abs(close - open);
      const isUp = close >= open;

      // 上影线：随机长度，上涨时更长
      const upperWickMult = isUp ? (0.2 + Math.random() * 0.6) : (0.1 + Math.random() * 0.3);
      const upperWick = bodySize * upperWickMult + Math.random() * 4;

      // 下影线：随机长度，下跌时更长
      const lowerWickMult = isUp ? (0.1 + Math.random() * 0.3) : (0.2 + Math.random() * 0.6);
      const lowerWick = bodySize * lowerWickMult + Math.random() * 4;

      high = Math.max(open, close) + upperWick;
      low = Math.min(open, close) - lowerWick;

      // 限制影线范围
      high = Math.min(92, high);
      low = Math.max(8, low);
    }

    candles.push({ open, close, high, low });
    currentPrice = close;
  }

  // 构建价格序列
  const prices = [priceState.basePrice];
  for (let i = 0; i < candles.length; i++) {
    prices.push(candles[i].close);
  }
  while (prices.length < total) {
    prices.push(currentPrice);
  }

  // 固定价格范围
  const maxPrice = 88;
  const minPrice = 12;
  const priceRange = maxPrice - minPrice;

  // 渲染每根蜡烛
  for (let i = 0; i < total; i++) {
    const el = children[i];
    el.classList.remove("answered", "current", "down", "up-strong");

    if (i < currentIdx && candles[i]) {
      const candle = candles[i];
      const isUp = candle.close >= candle.open;

      // 计算位置（百分比）
      const topPercent = ((maxPrice - candle.high) / priceRange) * 100;
      const bottomPercent = ((maxPrice - candle.low) / priceRange) * 100;
      const bodyTopPercent = ((maxPrice - Math.max(candle.open, candle.close)) / priceRange) * 100;
      const bodyBottomPercent = ((maxPrice - Math.min(candle.open, candle.close)) / priceRange) * 100;

      // 影线
      const wick = el.querySelector(".candle-wick");
      wick.style.top = `${topPercent}%`;
      wick.style.height = `${bottomPercent - topPercent}%`;

      // 蜡烛实体
      const body = el.querySelector(".candle-body");
      body.style.top = `${bodyTopPercent}%`;
      body.style.height = `${Math.max(bodyBottomPercent - bodyTopPercent, 3)}%`;

      el.classList.add("answered");
      if (!isUp) {
        el.classList.add("down");
      } else if (candle.close - candle.open > 6) {
        el.classList.add("up-strong");
      }
    } else {
      // 未答题或当前题：隐藏，不显示未来
      const body = el.querySelector(".candle-body");
      const wick = el.querySelector(".candle-wick");
      body.style.height = "0";
      wick.style.height = "0";
    }
  }

  return { ...priceState, prices, candles };
}

async function init() {
  // 动态注入文档 title / meta
  if (config.display?.title) document.title = config.display.title;

  initTicker();
  initPreviewCarousel();
  initImageMarquee();

  const hits = countDimensionHits(questions.main || []);

  const progressText = byId("progress-text");
  const caseId = byId("case-id");
  const questionText = byId("question-text");
  const questionHint = byId("question-hint");
  const optionsWrap = byId("options");

  function renderQuestion(q, progress) {
    if (!q) return;

    // K 线蜡烛 — 0-based 当前 index，传入答题历史、聪明决策序列和价格状态
    const curIdx = Math.max(0, progress.current - 1);
    priceState = renderCandleProgress(progress.total, curIdx, quiz.getAnswerHistory(), quiz.getSmartChoiceSequence(), priceState);

    setText(progressText, `${progress.current} / ${progress.total}`);
    setText(
      caseId,
      `CASE ${String(progress.current).padStart(2, "0")}/${String(progress.total).padStart(2, "0")}`,
    );
    setText(questionText, q.text);

    // hint
    if (q.special) {
      setText(questionHint, "彩蛋题 · 不参与主评分，可能触发隐藏档案");
      questionHint.style.display = "";
    } else if (progress.phase === "anchor") {
      setText(questionHint, "身份识别 · 不参与评分");
      questionHint.style.display = "";
    } else {
      setText(questionHint, "");
      questionHint.style.display = "none";
    }

    // 选项按钮（使用打乱后的选项）
    optionsWrap.innerHTML = "";
    const opts = q._shuffledOptions || q.options;
    opts.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option";
      btn.dataset.num = String.fromCharCode(65 + idx); // A / B / C
      btn.textContent = opt.label;
      // 存储原始 index 供 K 线使用
      const originalIdx = opt._originalIdx;
      btn.addEventListener("click", () => {
        if (btn.dataset.locked === "1") return;
        btn.dataset.locked = "1";
        // 锁全部
        Array.from(optionsWrap.children).forEach((c) => {
          c.dataset.locked = "1";
        });
        btn.classList.add("option-selected");
        // 微振动（Android 可用）
        if (navigator.vibrate)
          try {
            navigator.vibrate(12);
          } catch (_) {}
        // 盖章动画 320ms，延后切题
        // 传递 value 和原始 index
        setTimeout(() => handleAnswer(opt.value, originalIdx), 360);
      });
      optionsWrap.appendChild(btn);
    });
  }

  let quiz;
  let lastLevels = null;
  let lastResult = null;
  let lastIdentity = "junior";
  let priceState = null; // K 线价格状态

  function handleAnswer(value, originalIdx) {
    const next = quiz.answer(value, originalIdx);
    if (next) {
      renderQuestion(next, quiz.progress());
    } else {
      // 最后一题答完后，更新最后一根蜡烛
      const progress = quiz.progress();
      const curIdx = Math.max(0, progress.current - 1);
      priceState = renderCandleProgress(
        progress.total,
        curIdx,
        quiz.getAnswerHistory(),
        quiz.getSmartChoiceSequence(),
        priceState
      );
    }
  }

  function onComplete({ answers, identity, special, eggs }) {
    const scores = calcDimensionScores(answers, questions.main);
    const levels = scoresToLevels(
      scores,
      hits,
      config.scoring?.thresholdRatio ?? 0.5,
    );
    lastLevels = levels;
    const result = determineResult(
      levels,
      dimensions.order,
      types.standard,
      types.special,
      {
        fallbackThreshold: config.scoring?.fallbackThreshold ?? 45,
        showSecondary: config.ranking?.showSecondary ?? true,
      },
    );

    // 彩蛋触发
    const activeEggs = Array.isArray(eggs) ? eggs : [];
    for (const egg of activeEggs) {
      const chosen = special?.[egg.id];
      const trigger = egg.triggerOn;
      if (!trigger || chosen !== trigger.value) continue;
      const forced =
        types.special.find((t) => t.code === trigger.forceCode) ||
        types.standard.find((t) => t.code === trigger.forceCode);
      if (!forced) continue;
      const previousPrimary = result.primary;
      result.primary = {
        ...forced,
        similarity: 100,
        exact: dimensions.order.length,
        distance: 0,
        triggered: true,
        triggeredBy: egg.id,
      };
      result.secondary = previousPrimary || result.secondary;
      result.mode = "egg";
      break;
    }

    lastResult = result;
    lastIdentity = identity;

    showPage("result");
    requestAnimationFrame(() => {
      renderResult({
        result,
        levels,
        identity,
        dimensions,
        types,
        interpretations: { cognitive, behavioral, social },
        config,
        klineData: {
          basePrice: priceState?.basePrice || 50,
          candles: priceState?.candles || [],
          prices: priceState?.prices || [],
        },
      });
    });
  }

  quiz = createQuiz(questions, config, onComplete);

  // —— 首页 按钮 ——
  byId("btn-start").addEventListener("click", () => {
    priceState = null; // 重置 K 线价格
    const first = quiz.start();
    showPage("quiz");
    renderQuestion(first, quiz.progress());
  });

  byId("btn-restart").addEventListener("click", () => {
    priceState = null; // 重置 K 线价格
    const first = quiz.start();
    showPage("quiz");
    renderQuestion(first, quiz.progress());
  });

  // —— 分享海报 ——
  const posterModal = byId("poster-modal");
  const posterImg = byId("poster-img");
  const posterLoading = byId("poster-loading");
  const posterDownload = byId("poster-download");

  function openPosterModal() {
    posterModal.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closePosterModal() {
    posterModal.hidden = true;
    document.body.style.overflow = "";
  }

  byId("btn-share").addEventListener("click", async () => {
    if (!lastResult) return;
    openPosterModal();
    posterImg.style.display = "none";
    posterLoading.style.display = "";
    posterLoading.textContent = "生成分享卡…";
    try {
      const { renderPoster } = await import("./poster.js");
      const dataUrl = await renderPoster({
        primary: lastResult.primary,
        secondary: lastResult.secondary,
        levels: lastLevels,
        identity: lastIdentity,
        dimensions,
        mode: lastResult.mode,
      });
      posterImg.src = dataUrl;
      posterImg.style.display = "";
      posterLoading.style.display = "none";
      posterDownload.href = dataUrl;
    } catch (err) {
      console.error(err);
      posterLoading.textContent = "生成失败：" + (err?.message || "未知错误");
    }
  });

  byId("poster-close").addEventListener("click", closePosterModal);
  byId("poster-backdrop").addEventListener("click", closePosterModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !posterModal.hidden) closePosterModal();
  });

  // —— 雷达图 resize 重绘（结果页可见时） ——
  window.addEventListener(
    "resize",
    throttle(() => {
      if (!lastLevels) return;
      if (!byId("page-result").classList.contains("active")) return;
      renderRadar(
        byId("radar-chart"),
        dimensions.order,
        lastLevels,
        dimensions.definitions,
        {
          accent: "#c93a3a",
          accentFill: "rgba(201, 58, 58, 0.18)",
          grid: "rgba(26, 20, 10, 0.22)",
          gridStrong: "rgba(26, 20, 10, 0.5)",
          labelColor: "rgba(26, 20, 10, 0.82)",
        },
      );
    }, 150),
  );

  document.body.classList.add("app-ready");
}

init().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<div style="padding:2rem;color:#f0e4c8;font-family:sans-serif">加载失败：${err.message}</div>`;
});
