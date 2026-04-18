/**
 * 本地历史记录 — localStorage 读写 + 列表渲染
 * 仅处理用户端历史（不涉及 Firestore）
 */

const STORAGE_KEY = "fbti_history";
const MAX_RECORDS = 20;

export function getLocalHistory() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveToLocalHistory(record) {
  try {
    const history = getLocalHistory();
    history.unshift({
      ...record,
      timestamp: Date.now(),
    });
    if (history.length > MAX_RECORDS) history.pop();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn("无法保存历史记录:", e);
  }
}

/**
 * 渲染历史记录列表到 #history-list
 * @param {Function} onHistoryClick - 点击某条记录的回调
 */
export function renderHistoryList(onHistoryClick) {
  const container = document.getElementById("history-list");
  if (!container) return;

  const history = getLocalHistory();
  container.textContent = "";

  if (history.length === 0) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "暂无历史记录";
    container.appendChild(empty);
    return;
  }

  history.forEach((record) => {
    const item = document.createElement("div");
    item.className = "history-item";
    const date = new Date(record.timestamp);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
    const codeSpan = document.createElement("span");
    codeSpan.className = "history-code";
    codeSpan.textContent = record.code || "—";
    const nameSpan = document.createElement("span");
    nameSpan.className = "history-name";
    nameSpan.textContent = record.cn || "";
    const timeSpan = document.createElement("span");
    timeSpan.className = "history-time";
    timeSpan.textContent = dateStr;
    item.append(codeSpan, nameSpan, timeSpan);
    item.addEventListener("click", () => {
      if (onHistoryClick) onHistoryClick(record);
    });
    container.appendChild(item);
  });
}
