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
 * 原始分 → L/M/H 等级（标准差版 v2）
 *
 * 优化后的算法：基于标准差划分，让 L/M/H 分布更均衡
 * 随机答题时：L ~24%, M ~52%, H ~24%
 *
 * 规则：
 *   mean = n × 2 (期望值)
 *   stdDev = sqrt(n × 2/3) (均匀分布的标准差)
 *   lowThreshold = mean - 0.6 × stdDev
 *   highThreshold = mean + 0.6 × stdDev
 *   score ≤ lowThreshold  → L
 *   score ≥ highThreshold → H
 *   其他 → M
 *
 * @param {Object} scores   维度原始分
 * @param {Object} hits     每维被测次数
 * @param {number} ratio    保留参数，向后兼容
 * @returns {Object} { FOCUS: 'H', ... }
 */
export function scoresToLevels(scores, hits, ratio = 0.5) {
  const levels = {}
  for (const [dim, score] of Object.entries(scores)) {
    const n = hits[dim] || 1
    const mean = n * 2  // 期望值
    const stdDev = Math.sqrt(n * 2 / 3)  // 标准差
    const low = Math.floor(mean - 0.6 * stdDev)
    const high = Math.ceil(mean + 0.6 * stdDev)
    if (score <= low) levels[dim] = 'L'
    else if (score >= high) levels[dim] = 'H'
    else levels[dim] = 'M'
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
