/**
 * 账户 / 仓位 — 基于"档位"的纯函数式状态机。
 *
 * 仓位只有 4 档：0 · 1/3 · 2/3 · 全仓 (SLOT 0..3)。
 * 1 档 = 初始资金 / 3 —— 不是"当前仓位的 1/3"，是"全仓的 1/3"。
 *
 * 单次调仓（setSlot）逻辑：
 *   delta = target - prev
 *   delta > 0：buy `delta / 3 * initialCash` 元在当前价。
 *   delta < 0：sell 当前持仓的 |delta| / prev 份额（线性比例，匹配"买 1/3 只能卖 1/3"语义）。
 *   delta = 0：持仓不变（hold）。
 *
 * 每次测试新建一个 portfolio；它只暴露当前状态 + setSlot + summary。
 * 任何"回退到历史时刻"的重建，由调用方（main.js）用 slotHistory + candleCloses
 * 重新 createPortfolio() 然后按序 setSlot 回放 —— 纯推导，无持久副作用。
 */

export const INITIAL_CASH = 30000;
export const INITIAL_PRICE = 50;
export const SLOT_COUNT = 3;

export function createPortfolio(initialCash = INITIAL_CASH) {
  const state = {
    initialCash,
    cash: initialCash,
    shares: 0,
    slot: 0,
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
   * 调仓到目标档位，交易在 price 成交。
   * 返回 { ok, delta, cost, proceeds }
   */
  function setSlot(targetSlot, price) {
    const safeTarget = Math.max(0, Math.min(SLOT_COUNT, Math.round(targetSlot)));
    const prev = state.slot;
    const delta = safeTarget - prev;

    if (typeof price !== "number" || !isFinite(price) || price <= 0) {
      return { ok: false, reason: "no-price" };
    }
    if (delta === 0) {
      state.slot = safeTarget;
      updatePrice(price);
      return { ok: true, delta: 0 };
    }

    if (delta > 0) {
      const slotSize = state.initialCash / SLOT_COUNT;
      const targetCost = slotSize * delta;
      const cost = Math.min(targetCost, state.cash);
      if (cost <= 0) {
        state.slot = safeTarget; // 现金耗尽也允许升档（此时买入为 0），防止 UI 卡死
        updatePrice(price);
        return { ok: true, delta, cost: 0, reason: "no-cash" };
      }
      const addedShares = cost / price;
      state.cash -= cost;
      state.shares += addedShares;
      state.slot = safeTarget;
      updatePrice(price);
      return { ok: true, delta, cost };
    }

    // delta < 0
    if (prev <= 0 || state.shares <= 0) {
      state.slot = safeTarget;
      updatePrice(price);
      return { ok: true, delta, proceeds: 0, reason: "no-position" };
    }
    const fraction = Math.abs(delta) / prev; // 匹配"按档位比例卖"语义
    const sharesToSell = state.shares * fraction;
    const proceeds = sharesToSell * price;
    state.cash += proceeds;
    state.shares -= sharesToSell;
    if (state.shares < 1e-9) state.shares = 0;
    state.slot = safeTarget;
    updatePrice(price);
    return { ok: true, delta, proceeds };
  }

  function summary() {
    const final = value();
    const returnPctVal = ((final - state.initialCash) / state.initialCash) * 100;
    return {
      initialCash: state.initialCash,
      finalValue: final,
      finalCash: state.cash,
      finalShares: state.shares,
      finalSlot: state.slot,
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
    setSlot,
    summary,
  };
}

/**
 * 根据 slotHistory 与价格序列（candleCloses）重建 portfolio。
 * 纯函数：同样的输入产生同样的输出，不依赖任何外部可变状态。
 *
 * @param {Array<number>} slotHistory  每题（main idx 0..N-1）的锁定档位；undefined 视为沿用上一档
 * @param {Array<number>} candleCloses 每题（main idx 0..N-1）答完后 K 线 candle.close
 * @param {number} basePrice           起始价（默认 50）
 */
export function rebuildPortfolio(
  slotHistory,
  candleCloses,
  basePrice = INITIAL_PRICE,
  initialCash = INITIAL_CASH,
) {
  const p = createPortfolio(initialCash);
  p.updatePrice(basePrice);
  let lastSlot = 0;
  const n = Math.max(slotHistory.length, candleCloses.length);
  for (let i = 0; i < n; i++) {
    // 本题开盘价 = 上一根 close（或 basePrice）
    const openPrice = i === 0 ? basePrice : candleCloses[i - 1] ?? basePrice;
    const targetSlot = slotHistory[i] !== undefined ? slotHistory[i] : lastSlot;
    p.setSlot(targetSlot, openPrice);
    lastSlot = targetSlot;
    // 当日走完后，持仓按 close 更新市值（触发 peakValue）
    const closePrice = candleCloses[i];
    if (closePrice != null) p.updatePrice(closePrice);
  }
  return p;
}
