function scrapeGemini() {
  const items = document.querySelectorAll("user-query, model-response");
  const messages = [];

  items.forEach((item) => {
    const tagName = item.tagName.toLowerCase();

    const role =
      tagName === "user-query"? "user": "assistant";

    const contentElement =
      role === "user"
        ? item.querySelector(".query-text-line")
        : item.querySelector("message-content, .model-response-text");

    if (!contentElement) return;

    let text = contentElement.innerText.trim();

    //gemini ka helper prefix remove hojayega
    if (role === "user") {
      text = text.replace(/^you said\s+/i, "");
    }

    if (text) {
      messages.push({role,text});
    }
  });

  return messages;
}

window.RelayContextGemini = {
  scrape: scrapeGemini
};