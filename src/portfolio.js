/**
 * 账户 / 仓位 — 连续仓位 (position ∈ [0, 1]) 的纯函数式状态机。
 *
 * 仓位为一个 0-1 的浮点数（步长 0.1 在 UI 约束）。
 * position × initialCash = 累计投入的本金成本（不是市值）。
 *
 * 单次调仓（setPosition）逻辑：
 *   delta = target - prev
 *   delta > 0：buy `delta × initialCash` 元（按当前价成交）。
 *   delta < 0：sell 当前持仓的 |delta| / prev 份额（按比例平仓）。
 *   delta = 0：持仓不变（hold）。
 *
 * 每次测试新建一个 portfolio；任何"回退到历史时刻"的重建，由调用方
 * 用 positionHistory + candleCloses 调 rebuildPortfolio —— 纯推导无副作用。
 *
 * 向后兼容：保留 setSlot / SLOT_COUNT 常量别名（内部映射到 position）。
 */

export const INITIAL_CASH = 30000;
export const INITIAL_PRICE = 50;
export const POSITION_STEP = 0.1;      // 滑杆粒度：10%
export const SLOT_COUNT = 10;          // 兼容旧调用（现在表示 10 格）

/** 规范化 position 到 [0,1]，并按步长 POSITION_STEP 做 snap（避免浮点碎片） */
function normalizePosition(p) {
  if (!isFinite(p)) return 0;
  const clamped = Math.max(0, Math.min(1, p));
  return Math.round(clamped / POSITION_STEP) * POSITION_STEP;
}

export function createPortfolio(initialCash = INITIAL_CASH) {
  const state = {
    initialCash,
    cash: initialCash,
    shares: 0,
    position: 0,                      // [0, 1] 浮点仓位
    lastPrice: null,
    peakValue: initialCash,
  };

  function updatePrice(price) {
    if (typeof price !== "number" || !isFinite(price) || price <= 0) return;
    state.lastPrice = price;
    const v = value();
    if (v > state.peakValue) state.peakValue = v;
  }

  function value(price) {
    const p = price ?? state.lastPrice;
    if (p == null) return state.cash;
    return state.cash + state.shares * p;
  }

  function returnPct(price) {
    return ((value(price) - state.initialCash) / state.initialCash) * 100;
  }

  /**
   * 调仓到目标仓位（0..1），交易在 price 成交。
   * @returns { ok, delta, cost?, proceeds? }
   */
  function setPosition(targetPos, price) {
    const safeTarget = normalizePosition(targetPos);
    const prev = state.position;
    const delta = safeTarget - prev;

    if (typeof price !== "number" || !isFinite(price) || price <= 0) {
      return { ok: false, reason: "no-price" };
    }
    if (Math.abs(delta) < 1e-9) {
      state.position = safeTarget;
      updatePrice(price);
      return { ok: true, delta: 0 };
    }

    if (delta > 0) {
      const targetCost = state.initialCash * delta; // 按本金增量买入
      const cost = Math.min(targetCost, state.cash);
      if (cost <= 0) {
        state.position = safeTarget;
        updatePrice(price);
        return { ok: true, delta, cost: 0, reason: "no-cash" };
      }
      const addedShares = cost / price;
      state.cash -= cost;
      state.shares += addedShares;
      state.position = safeTarget;
      updatePrice(price);
      return { ok: true, delta, cost };
    }

    // delta < 0：按"减仓比例 / 原仓位"卖出现有持仓
    if (prev <= 0 || state.shares <= 0) {
      state.position = safeTarget;
      updatePrice(price);
      return { ok: true, delta, proceeds: 0, reason: "no-position" };
    }
    const fraction = Math.abs(delta) / prev;
    const sharesToSell = state.shares * fraction;
    const proceeds = sharesToSell * price;
    state.cash += proceeds;
    state.shares -= sharesToSell;
    if (state.shares < 1e-9) state.shares = 0;
    state.position = safeTarget;
    updatePrice(price);
    return { ok: true, delta, proceeds };
  }

  // 向后兼容：旧代码用 setSlot（0..SLOT_COUNT 整数），内部映射到 position
  function setSlot(targetSlot, price) {
    const p = Math.max(0, Math.min(SLOT_COUNT, Math.round(targetSlot))) / SLOT_COUNT;
    return setPosition(p, price);
  }

  function summary() {
    const final = value();
    const returnPctVal = ((final - state.initialCash) / state.initialCash) * 100;
    return {
      initialCash: state.initialCash,
      finalValue: final,
      finalCash: state.cash,
      finalShares: state.shares,
      finalPosition: state.position,
      finalSlot: Math.round(state.position * SLOT_COUNT), // 兼容旧字段
      lastPrice: state.lastPrice,
      peakValue: state.peakValue,
      returnPct: returnPctVal,
    };
  }

  return {
    get state() {
      return state;
    },
    updatePrice,
    value,
    returnPct,
    setPosition,
    setSlot,
    summary,
  };
}

/**
 * 根据 positionHistory 与价格序列重建 portfolio。
 * 纯函数 —— 同样输入同样输出，不依赖任何外部状态。
 *
 * @param {Array<number>} positionHistory 每题锁定的仓位 [0,1]；undefined 视为沿用上一日
 * @param {Array<number>} candleCloses    每题答完后 K 线 candle.close
 * @param {number} basePrice              起始价（默认 50）
 */
export function rebuildPortfolio(
  positionHistory,
  candleCloses,
  basePrice = INITIAL_PRICE,
  initialCash = INITIAL_CASH,
) {
  const p = createPortfolio(initialCash);
  p.updatePrice(basePrice);
  let lastPos = 0;
  const n = Math.max(positionHistory.length, candleCloses.length);
  for (let i = 0; i < n; i++) {
    const openPrice = i === 0 ? basePrice : candleCloses[i - 1] ?? basePrice;
    const targetPos = positionHistory[i] !== undefined ? positionHistory[i] : lastPos;
    p.setPosition(targetPos, openPrice);
    lastPos = targetPos;
    const closePrice = candleCloses[i];
    if (closePrice != null) p.updatePrice(closePrice);
  }
  return p;
}
