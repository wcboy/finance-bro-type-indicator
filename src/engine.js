/**
 * FBTI 评分引擎 — 纯函数，无 DOM 依赖
 *
 * 相对 SBTI 的泛化点：
 * 1. 每题可同时测量多个维度：`q.dims[]`（兼容 `q.dim` 字符串）
 * 2. 阈值支持动态计算：按维度被测次数 n 推出 L/H 阈值
 * 3. Pattern 支持 `"H-H-H-H-L-H-H-H-L-L-L-H"` 或 SBTI 式连写
 * 4. maxDistance 从 `dimensions.order.length * 2` 推导
 * 5. 支持选项级别的维度得分覆盖（dimScores 字段）
 */

const LEVEL_NUM = { L: 1, M: 2, H: 3 }

/** 兼容 q.dim (字符串) 和 q.dims (数组) */
function questionDims(q) {
  if (Array.isArray(q.dims)) return q.dims
  if (q.dim) return [q.dim]
  return []
}

/**
 * 按维度求和：每道题的分值累加到它测量的每一个维度
 * 支持选项级别的 dimScores 覆盖
 * @param {Object} answers    { q1: 2, q2: 3, ... } 或 { q1: { optionIdx: 2 }, ... }
 * @param {Array}  questions  题目数组（main）
 * @returns {Object} { FOCUS: 5, MEMORY: 10, ... }
 */
export function calcDimensionScores(answers, questions) {
  const scores = {}
  for (const q of questions) {
    const answer = answers[q.id]
    if (answer == null) continue

    // 获取选中的选项索引（兼容旧格式）
    let selectedIdx = typeof answer === 'object' ? answer.optionIdx : null
    let selectedValue = typeof answer === 'number' ? answer : answer.value

    // 查找选中的选项
    const opts = q.options || []
    let selectedOpt = null
    if (selectedIdx != null) {
      selectedOpt = opts[selectedIdx]
    } else {
      // 旧格式：通过 value 查找
      selectedOpt = opts.find(opt => opt.value === selectedValue)
    }

    // 计算各维度得分
    const dims = questionDims(q)
    if (selectedOpt?.dimScores) {
      // 新格式：使用选项级别的维度得分
      for (const [dim, score] of Object.entries(selectedOpt.dimScores)) {
        scores[dim] = (scores[dim] || 0) + score
      }
    } else {
      // 旧格式：value 累加到所有维度
      const v = selectedOpt?.value ?? selectedValue
      for (const dim of dims) {
        scores[dim] = (scores[dim] || 0) + v
      }
    }
  }
  return scores
}

/**
 * 统计每个维度被多少道题测量
 * 支持选项级别的维度得分
 */
export function countDimensionHits(questions) {
  const hits = {}
  for (const q of questions) {
    // 检查是否有选项使用 dimScores
    const hasDimScores = (q.options || []).some(opt => opt.dimScores)

    if (hasDimScores) {
      // 新格式：统计所有选项中涉及的维度
      const allDims = new Set()
      for (const opt of q.options) {
        if (opt.dimScores) {
          Object.keys(opt.dimScores).forEach(dim => allDims.add(dim))
        }
      }
      for (const dim of allDims) {
        hits[dim] = (hits[dim] || 0) + 1
      }
    } else {
      // 旧格式：使用 dims 数组
      for (const dim of questionDims(q)) {
        hits[dim] = (hits[dim] || 0) + 1
      }
    }
  }
  return hits
}

/**
 * 从题库推导每个维度的随机答题期望与标准差，给出 L/M/H 阈值。
 *
 * 为什么需要这一步：
 *   旧算法假设"每题给每个测过的维度贡献均值 2 分"——在旧式 value=1-3 且每题
 *   整体套到 dims[] 里时成立。引入选项级 dimScores 后，同一题不同选项可能完全
 *   不给某个维度分（0 分），真实期望≠2；继续用旧公式会导致几乎所有维度 →L，
 *   主人格被挤到全 L 的 BEAN 上。
 *
 * 算法：
 *   对每题 q, 维度 d: 将 d 的 4 选项分数 [s1,s2,s3,s4] 视为等概率抽样，
 *     μ_q = mean(s_i), σ²_q = var(s_i)
 *   跨题独立累加：μ(d) = Σμ_q, σ²(d) = Σσ²_q
 *   阈值：low = μ - k·σ, high = μ + k·σ (k=0.6 对正态近似给 ~27/46/27)
 *
 * @param {Array}  questions  主题目数组
 * @param {number} k          标准差倍数（默认 0.6）
 * @returns {Object} { [dim]: { mean, stdDev, low, high } }
 */
export function computeLevelThresholds(questions, k = 0.6) {
  const stats = {}
  for (const q of questions) {
    const opts = q.options || []
    if (opts.length === 0) continue
    const nOpts = opts.length

    // 本题涉及哪些维度：dimScores 全集 ∪ q.dims/q.dim
    const qDims = new Set()
    for (const o of opts) {
      if (o.dimScores) for (const d of Object.keys(o.dimScores)) qDims.add(d)
    }
    const legacyDims = Array.isArray(q.dims) ? q.dims : (q.dim ? [q.dim] : [])
    for (const d of legacyDims) qDims.add(d)

    for (const dim of qDims) {
      // 每个选项对该维度的得分（缺省 0）
      const scoresArr = opts.map((o) => {
        if (o.dimScores && o.dimScores[dim] !== undefined) return o.dimScores[dim]
        // 旧格式：q.dims 包含 dim 且 option 有数字 value
        if (legacyDims.includes(dim) && typeof o.value === 'number') return o.value
        return 0
      })
      const mean = scoresArr.reduce((a, b) => a + b, 0) / nOpts
      const variance = scoresArr.reduce((s, x) => s + (x - mean) ** 2, 0) / nOpts
      if (!stats[dim]) stats[dim] = { mean: 0, variance: 0 }
      stats[dim].mean += mean
      stats[dim].variance += variance
    }
  }

  const thresholds = {}
  for (const [dim, { mean, variance }] of Object.entries(stats)) {
    const stdDev = Math.sqrt(variance)
    thresholds[dim] = {
      mean,
      stdDev,
      low: mean - k * stdDev,
      high: mean + k * stdDev,
    }
  }
  return thresholds
}

/**
 * 原始分 → L/M/H 等级。
 *
 * 第二参数接受 thresholds（新，来自 computeLevelThresholds）或 hits（旧，
 * 用 n*2 常数公式做向后兼容，但已不推荐——随 dimScores 稀疏度上升会失真）。
 *
 * 注：遍历 thresholds 的所有维度而非 scores 的维度——用户未得分（=0）的
 * 维度本该被判 L，旧实现遗漏会让其保持 M。
 *
 * @param {Object} scores                 用户维度原始分
 * @param {Object} thresholdsOrHits       computeLevelThresholds 的输出，或旧 hits 对象
 * @returns {Object} { FOCUS: 'H', ... }
 */
export function scoresToLevels(scores, thresholdsOrHits) {
  const sample = thresholdsOrHits && Object.values(thresholdsOrHits)[0]
  const isThresholds = sample && typeof sample === 'object' && 'low' in sample

  const levels = {}
  if (isThresholds) {
    for (const [dim, th] of Object.entries(thresholdsOrHits)) {
      const score = scores[dim] || 0
      if (score <= th.low) levels[dim] = 'L'
      else if (score >= th.high) levels[dim] = 'H'
      else levels[dim] = 'M'
    }
  } else {
    const hits = thresholdsOrHits || {}
    for (const [dim, score] of Object.entries(scores)) {
      const n = hits[dim] || 1
      const mean = n * 2
      const stdDev = Math.sqrt((n * 2) / 3)
      const low = Math.floor(mean - 0.6 * stdDev)
      const high = Math.ceil(mean + 0.6 * stdDev)
      if (score <= low) levels[dim] = 'L'
      else if (score >= high) levels[dim] = 'H'
      else levels[dim] = 'M'
    }
  }
  return levels
}

/**
 * 解析 pattern 字符串，兼容两种格式：
 *   "H-H-H-H-L-H-H-H-L-L-L-H" → ['H','H','H','H','L','H','H','H','L','L','L','H']
 *   "HHH-HMH-MHH-HHH"         → 去掉横杠拆字符
 */
export function parsePattern(pattern) {
  if (!pattern) return []
  const parts = pattern.split('-')
  // 如果每段都是单字符，认为是 "H-H-H..." 新格式
  if (parts.every((p) => p.length === 1)) return parts
  // 否则按 SBTI 旧格式，去掉分隔符逐字符拆
  return pattern.replace(/-/g, '').split('')
}

/**
 * 计算用户向量与类型 pattern 的曼哈顿距离
 */
export function matchType(userLevels, dimOrder, pattern) {
  const typeLevels = parsePattern(pattern)
  const maxDistance = dimOrder.length * 2
  let distance = 0
  let exact = 0

  for (let i = 0; i < dimOrder.length; i++) {
    const userVal = LEVEL_NUM[userLevels[dimOrder[i]]] || 2
    const typeVal = LEVEL_NUM[typeLevels[i]] || 2
    const diff = Math.abs(userVal - typeVal)
    distance += diff
    if (diff === 0) exact++
  }

  const similarity = Math.max(0, Math.round((1 - distance / maxDistance) * 100))
  return { distance, exact, similarity, maxDistance }
}

/**
 * 匹配所有类型，排序，应用 FALLBACK 兜底
 * @param {Object}  userLevels
 * @param {Array}   dimOrder
 * @param {Array}   standardTypes
 * @param {Array}   specialTypes
 * @param {Object}  options   { fallbackThreshold: 45, showSecondary: true }
 */
export function determineResult(userLevels, dimOrder, standardTypes, specialTypes = [], options = {}) {
  const { fallbackThreshold = 45, showSecondary = true } = options

  const rankings = standardTypes.map((type) => ({
    ...type,
    ...matchType(userLevels, dimOrder, type.pattern),
  }))

  // 排序：距离升序 → 精准命中降序 → 相似度降序
  rankings.sort(
    (a, b) => a.distance - b.distance || b.exact - a.exact || b.similarity - a.similarity,
  )

  const best = rankings[0]
  const fallback = specialTypes.find((t) => t.code === 'NPC')

  // 无匹配结果
  if (!best) {
    return {
      primary: fallback || null,
      secondary: null,
      rankings,
      mode: 'fallback',
    }
  }

  // 兜底
  if (best.similarity < fallbackThreshold && fallback) {
    return {
      primary: { ...fallback, similarity: best.similarity, exact: best.exact, distance: best.distance },
      secondary: showSecondary ? best : null,
      rankings,
      mode: 'fallback',
    }
  }

  return {
    primary: best,
    secondary: showSecondary ? rankings[1] || null : null,
    rankings,
    mode: 'normal',
  }
}
