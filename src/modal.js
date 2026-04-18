/**
 * 模态框工具 — 全部用 DOM API 构建，不使用 innerHTML
 */

/**
 * 显示回退确认弹窗，用户点击"我知道了"后 resolve
 * @returns {Promise<void>}
 */
export function showBackPopup() {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "back-modal";

    const content = document.createElement("div");
    content.className = "back-modal-content";

    const title = document.createElement("div");
    title.className = "back-modal-title";
    title.textContent = "提示";

    const text = document.createElement("div");
    text.className = "back-modal-text";
    text.append("你可以更改作答，但你的");
    const strong = document.createElement("strong");
    strong.textContent = "K线不可以回到昨天";
    text.appendChild(strong);
    text.append("。");

    const btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.textContent = "我知道了";
    btn.addEventListener("click", () => {
      modal.remove();
      resolve();
    });

    content.append(title, text, btn);
    modal.appendChild(content);
    document.body.appendChild(modal);
  });
}
