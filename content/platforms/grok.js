function scrapeGrok() {
  const items = document.querySelectorAll(
    '[data-testid="user-message"], [data-testid="assistant-message"]',
  );

  const messages = [];

  items.forEach((item) => {
    const type = item.getAttribute("data-testid");

    const role = type === "user-message" ? "user" : "assistant";

    const contentElem = item.querySelector(".response-content-markdown");

    if (!contentElem) return;

    const text = contentElem.innerText.trim();

    if (text) {
      messages.push({role,text});
    }
  });

  return messages;
}

window.RelayContextGrok = {
  scrape: scrapeGrok,
};
