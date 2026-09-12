function scrapeChatGPT() {
  const messageElements = document.querySelectorAll(
    '[data-message-author-role="user"], [data-message-author-role="assistant"]'
  );

  const messages = [];

  messageElements.forEach((element) => {
    const role = element.getAttribute("data-message-author-role");
    const text = element.innerText?.trim();

    if (!text) return;

    messages.push({
      role,
      text
    });
  });

  return messages;
}

window.RelayContextChatGPT = {
  scrape: scrapeChatGPT
};