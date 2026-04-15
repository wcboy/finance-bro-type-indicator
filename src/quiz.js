/**
 * FBTI 答题流程控制
 *
 * 顺序：anchor 身份题 → 30 道主题 → 2 道随机彩蛋（从 4 个 easter_egg 池里洗牌抽取）→ 完成回调
 *
 * 彩蛋机制：
 *   - special[] 中 kind === 'easter_egg' 的题会进入抽奖池
 *   - 每次测试随机抽 2 题，顺序也是随机的
 *   - 选中 triggerOn.value 对应选项时，main.js 会把主人格强制替换为 forceCode
 */

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 打乱题目选项顺序，返回新选项数组（保持 value 不变）
 * 同时记录原始 index 供 K 线引擎使用
 */
function shuffleOptions(options) {
  const indexed = options.map((opt, idx) => ({ ...opt, _originalIdx: idx }))
  return shuffle(indexed)
}

export function createQuiz(questions, config, onComplete) {
  const anchorQs = questions.anchor || []
  const mainQs = questions.main || []

  // 彩蛋池：4 选 2 随机
  const allSpecials = questions.special || []
  const easterPool = allSpecials.filter((q) => q.kind === 'easter_egg')
  const eggCount = Math.min(config.easterEggs?.pickCount ?? 2, easterPool.length)
  const pickedEggs = shuffle(easterPool).slice(0, eggCount)

  // 兼容保留：非彩蛋的 special（如历史 wealth_gate 配置）
  const legacySpecials = allSpecials.filter((q) => {
    if (q.kind === 'easter_egg') return false
    if (q.kind === 'wealth_gate') return config.wealthGate?.enabled === true
    return false
  })

  // 正式答题序列（不含 anchor，anchor 单独渲染）
  // 每道题的选项预先打乱，并保留 scenario 和 smartChoice 字段
  const orderedMain = [...mainQs, ...legacySpecials, ...pickedEggs].map(q => ({
    ...q,
    _shuffledOptions: q.options ? shuffleOptions(q.options) : undefined
  }))
  const totalQuestions = anchorQs.length + orderedMain.length

  // 构建场景序列和聪明决策序列（用于 K 线引擎）
  const scenarioSequence = orderedMain.map(q => q.scenario || 'neutral')
  const smartChoiceSequence = orderedMain.map(q => q.smartChoice || 2)

  const state = {
    identity: 'junior', // intern | junior | senior
    answers: {},
    special: {},
    phase: 'anchor', // anchor | main | done
    anchorIdx: 0,
    mainIdx: 0,
    // 记录每题选择的原始 index（用于 K 线）
    answerHistory: [], // [{ questionId, originalIdx, value }]
    // 记录首次答题状态（用于回退时保留 K 线）
    firstAnswerHistory: [], // 首次答题的完整历史
    hasGoneBack: false, // 是否曾使用过回退功能
  }

  function currentIndex() {
    if (state.phase === 'anchor') return state.anchorIdx
    if (state.phase === 'main') return anchorQs.length + state.mainIdx
    return totalQuestions
  }

  function currentQuestion() {
    if (state.phase === 'anchor') return anchorQs[state.anchorIdx]
    if (state.phase === 'main') {
      const q = orderedMain[state.mainIdx]
      // 返回打乱后的选项
      if (q._shuffledOptions) {
        return { ...q, options: q._shuffledOptions }
      }
      return q
    }
    return null
  }

  function start() {
    state.identity = 'junior'
    state.answers = {}
    state.special = {}
    state.phase = 'anchor'
    state.anchorIdx = 0
    state.mainIdx = 0
    state.answerHistory = []
    state.firstAnswerHistory = []
    state.hasGoneBack = false
    if (anchorQs.length === 0) state.phase = 'main'
    if (orderedMain.length === 0 && anchorQs.length === 0) {
      finish()
      return
    }
    return currentQuestion()
  }

  function answer(optionValue, originalIdx = null) {
    const q = currentQuestion()
    if (!q) return

    if (state.phase === 'anchor') {
      state.identity = optionValue
      state.anchorIdx += 1
      if (state.anchorIdx >= anchorQs.length) {
        state.phase = orderedMain.length > 0 ? 'main' : 'done'
      }
    } else if (state.phase === 'main') {
      if (q.special) {
        state.special[q.id] = optionValue
      } else {
        state.answers[q.id] = optionValue
      }
      // 记录答题历史（原始 index）
      const answerRecord = {
        questionId: q.id,
        originalIdx: originalIdx,
        value: optionValue
      }
      state.answerHistory.push(answerRecord)
      // 首次答题时保存历史（用于 K 线）
      if (!state.hasGoneBack && state.firstAnswerHistory.length < state.answerHistory.length) {
        state.firstAnswerHistory.push(answerRecord)
      }
      state.mainIdx += 1
      if (state.mainIdx >= orderedMain.length) {
        state.phase = 'done'
      }
    }

    if (state.phase === 'done') {
      finish()
      return null
    }

    return currentQuestion()
  }

  /**
   * 回退到上一题
   * @returns {Object|null} 上一题的问题对象，或 null 表示无法回退
   */
  function goBack() {
    if (state.phase === 'anchor') {
      if (state.anchorIdx === 0) return null
      state.anchorIdx -= 1
      return currentQuestion()
    }
    if (state.phase === 'main') {
      if (state.mainIdx === 0) {
        // 回退到 anchor 阶段
        if (anchorQs.length === 0) return null
        state.phase = 'anchor'
        state.anchorIdx = anchorQs.length - 1
        return currentQuestion()
      }
      state.mainIdx -= 1
      // 标记已使用回退功能
      if (!state.hasGoneBack) {
        state.hasGoneBack = true
        // 如果是第一次回退，保存当前的 K 线历史
        if (state.firstAnswerHistory.length === 0) {
          state.firstAnswerHistory = [...state.answerHistory]
        }
      }
      return currentQuestion()
    }
    return null
  }

  function finish() {
    onComplete({
      answers: state.answers,
      identity: state.identity,
      special: state.special,
      // 把本次用到的彩蛋题也带出，方便上层回查 triggerOn
      eggs: pickedEggs,
      // 答题历史供 K 线使用
      answerHistory: state.answerHistory,
    })
  }

  function progress() {
    const idx = currentIndex()
    return {
      current: Math.min(idx + 1, totalQuestions),
      total: totalQuestions,
      percent: Math.round(
        (Math.min(idx, totalQuestions) / Math.max(1, totalQuestions)) * 100,
      ),
      phase: state.phase,
    }
  }

  function getAnswerHistory() {
    return state.answerHistory
  }

  function getScenarioSequence() {
    return scenarioSequence
  }

  function getSmartChoiceSequence() {
    return smartChoiceSequence
  }

  function getFirstAnswerHistory() {
    return state.firstAnswerHistory.length > 0 ? state.firstAnswerHistory : state.answerHistory
  }

  function hasUsedGoBack() {
    return state.hasGoneBack
  }

  return {
    start,
    answer,
    goBack,
    progress,
    currentQuestion,
    getAnswerHistory,
    getFirstAnswerHistory,
    getScenarioSequence,
    getSmartChoiceSequence,
    hasUsedGoBack,
    get state() {
      return state
    },
  }
}
