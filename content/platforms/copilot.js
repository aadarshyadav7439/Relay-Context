function scrapeCopilot() {
  const items = document.querySelectorAll(
    '[data-content="user-message"], [data-content="ai-message"]',
  );

  const messages = [];

  items.forEach((item) => {
    const type = item.getAttribute("data-content");
    const role = type === "user-message" ? "user" : "assistant";

    const contentElem = role === "user" ? item : item.querySelector(".group\\/ai-message-item");

    if (!contentElem) return;

    let text = contentElem.innerText.trim();
    if (role === "assistant") {
      text = text
        .replace(/^Copilot said\s*/i, "")
        .replace(/\s*Edit in a page\s*$/i, "")
        .trim();
    }
    if (text) {
      messages.push({ role, text });
    }
  });

  return messages;
}

window.RelayContextCopilot = {
  scrape: scrapeCopilot,
};
