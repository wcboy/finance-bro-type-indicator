/**
 * 数据 Schema 校验 — 启动时跑一次，静默错误转成显式抛出
 * 不做深度校验，只保证引擎与 UI 不会因缺字段而静默崩溃
 */

function assert(cond, msg) {
  if (!cond) throw new Error(`[data] ${msg}`);
}

function isNonEmptyArray(x) {
  return Array.isArray(x) && x.length > 0;
}

function validateOption(opt, qId, idx, role) {
  assert(opt && typeof opt === "object", `Q ${qId} 选项 #${idx} 不是对象`);
  assert(typeof opt.label === "string" && opt.label.length > 0, `Q ${qId} 选项 #${idx} 缺少 label`);
  // anchor 题的 value 是字符串身份标签 (intern/junior/senior)，不参与评分
  // 只有 main 题要求 value:number 或 dimScores
  if (role === "main") {
    assert(
      typeof opt.value === "number" || opt.dimScores,
      `Q ${qId} 选项 #${idx} 缺少 value(number) 或 dimScores`
    );
  } else {
    assert(
      opt.value !== undefined && opt.value !== null,
      `Q ${qId} 选项 #${idx} 缺少 value`
    );
  }
  if (opt.dimScores) {
    assert(typeof opt.dimScores === "object", `Q ${qId} 选项 #${idx} dimScores 不是对象`);
  }
}

function validateQuestion(q, role) {
  assert(q && typeof q === "object", `${role} 题目不是对象`);
  assert(typeof q.id === "string" && q.id.length > 0, `${role} 题目缺少 id`);
  assert(typeof q.text === "string" && q.text.length > 0, `Q ${q.id} 缺少 text`);
  assert(isNonEmptyArray(q.options), `Q ${q.id} 缺少 options`);
  q.options.forEach((o, i) => validateOption(o, q.id, i, role));
  if (role === "main") {
    const hasDimScores = q.options.some((o) => o.dimScores);
    const hasDims = Array.isArray(q.dims) || typeof q.dim === "string";
    assert(hasDimScores || hasDims, `Q ${q.id} 缺少 dims 且所有选项也无 dimScores`);
  }
}

export function validateQuestions(questions) {
  assert(questions && typeof questions === "object", "questions.json 不是对象");
  assert(isNonEmptyArray(questions.anchor), "questions.anchor 缺失或为空");
  assert(isNonEmptyArray(questions.main), "questions.main 缺失或为空");
  questions.anchor.forEach((q) => validateQuestion(q, "anchor"));
  questions.main.forEach((q) => validateQuestion(q, "main"));

  const ids = new Set();
  [...questions.anchor, ...questions.main].forEach((q) => {
    assert(!ids.has(q.id), `题目 id 重复: ${q.id}`);
    ids.add(q.id);
  });
}

export function validateDimensions(dimensions) {
  assert(dimensions && typeof dimensions === "object", "dimensions.json 不是对象");
  assert(isNonEmptyArray(dimensions.order), "dimensions.order 缺失或为空");
  assert(dimensions.definitions && typeof dimensions.definitions === "object", "dimensions.definitions 缺失");
  dimensions.order.forEach((dim) => {
    assert(typeof dim === "string", `dimensions.order 包含非字符串: ${dim}`);
    assert(dimensions.definitions[dim], `维度 ${dim} 在 definitions 中缺失`);
  });
}

export function validateTypes(types) {
  assert(types && typeof types === "object", "types.json 不是对象");
  assert(isNonEmptyArray(types.standard), "types.standard 缺失或为空");
  types.standard.forEach((t, i) => {
    assert(t && typeof t === "object", `types.standard #${i} 不是对象`);
    assert(typeof t.code === "string", `types.standard #${i} 缺少 code`);
    assert(typeof t.pattern === "string", `types.standard[${t.code}] 缺少 pattern`);
  });
}

export function validateAll({ questions, dimensions, types }) {
  validateQuestions(questions);
  validateDimensions(dimensions);
  validateTypes(types);
}
