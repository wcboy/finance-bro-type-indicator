/**
 * 账户 / 仓位管理 — 纯状态容器，不依赖 DOM
 *
 * 每次测试都生成独立实例：起始现金 30000，无仓位。
 * 操作：买 1/3、买 2/3、All in、持仓（记录一次 hold）、清仓、卖 2/3、卖 1/3。
 * 交易价 = 当前 K 线最新收盘价（外部 updatePrice 喂入）。
 */

const INITIAL_CASH = 30000;

export function createPortfolio(initialCash = INITIAL_CASH) {
  const state = {
    initialCash,
    cash: initialCash,
    shares: 0,
    avgCost: 0,
    lastPrice: null,
    peakValue: initialCash,
    trades: [],
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

  function buy(ratio, price = state.lastPrice) {
    if (price == null || price <= 0) return { ok: false, reason: "no-price" };
    if (state.cash <= 0) return { ok: false, reason: "no-cash" };
    const clampedRatio = Math.min(1, Math.max(0, ratio));
    const cost = state.cash * clampedRatio;
    if (cost <= 0.01) return { ok: false, reason: "zero-cost" };
    const newShares = cost / price;
    const totalOldCost = state.avgCost * state.shares;
    state.shares += newShares;
    state.cash -= cost;
    state.avgCost = state.shares > 0 ? (totalOldCost + cost) / state.shares : 0;
    state.trades.push({
      type: "buy",
      ratio: clampedRatio,
      price,
      cost,
      shares: newShares,
      cashAfter: state.cash,
      sharesAfter: state.shares,
      valueAfter: value(),
      t: Date.now(),
    });
    updatePrice(price);
    return { ok: true, cost, shares: newShares };
  }

  function sell(ratio, price = state.lastPrice) {
    if (price == null || price <= 0) return { ok: false, reason: "no-price" };
    if (state.shares <= 0) return { ok: false, reason: "no-position" };
    const clampedRatio = Math.min(1, Math.max(0, ratio));
    const shares = state.shares * clampedRatio;
    if (shares <= 0) return { ok: false, reason: "zero-shares" };
    const proceeds = shares * price;
    state.cash += proceeds;
    state.shares -= shares;
    if (state.shares < 1e-6) {
      state.shares = 0;
      state.avgCost = 0;
    }
    state.trades.push({
      type: "sell",
      ratio: clampedRatio,
      price,
      proceeds,
      shares,
      cashAfter: state.cash,
      sharesAfter: state.shares,
      valueAfter: value(),
      t: Date.now(),
    });
    updatePrice(price);
    return { ok: true, proceeds, shares };
  }

  function allIn(price = state.lastPrice) {
    return buy(1, price);
  }
  function clear(price = state.lastPrice) {
    return sell(1, price);
  }
  function hold() {
    // 空操作，仅记录一次 hold（用于后续展示"按兵不动次数"）
    state.trades.push({
      type: "hold",
      price: state.lastPrice,
      cashAfter: state.cash,
      sharesAfter: state.shares,
      valueAfter: value(),
      t: Date.now(),
    });
    return { ok: true };
  }

  function summary() {
    const final = value();
    const returnPct = ((final - state.initialCash) / state.initialCash) * 100;
    const tradeCount = state.trades.filter((x) => x.type !== "hold").length;
    const holdCount = state.trades.filter((x) => x.type === "hold").length;
    return {
      initialCash: state.initialCash,
      finalValue: final,
      finalCash: state.cash,
      finalShares: state.shares,
      avgCost: state.avgCost,
      lastPrice: state.lastPrice,
      peakValue: state.peakValue,
      returnPct,
      tradeCount,
      holdCount,
    };
  }

  return {
    get state() {
      return state;
    },
    updatePrice,
    value,
    buy,
    sell,
    allIn,
    clear,
    hold,
    summary,
  };
}
