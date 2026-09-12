function scrapeCopilot() {
  const items = document.querySelectorAll(
    '[data-content="user-message"], [data-content="ai-message"]'
  );

  const messages = [];

  items.forEach((item) => {
    const type = item.getAttribute("data-content");
    const role = type === "user-message" ? "user" : "assistant";

    const text = item.innerText.trim();

    if (text) {
      messages.push({ role, text });
    }
  });

  return messages;
}

window.RelayContextCopilot = {
  scrape: scrapeCopilot
};