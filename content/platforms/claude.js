function scrapeClaude() {
  const rows = document.querySelectorAll(
    '[data-testid="transcript-row"][data-perf-row="human"], ' +
      '[data-testid="transcript-row"][data-perf-row="assistant"]',
  );

  const messages = [];

  rows.forEach((row) => {
    const type = row.getAttribute("data-perf-row");
    const role = type === "human" ? "user" : "assistant";

    const content = row.querySelector('[role="article"]');

    if (!content) return;

    // clone jisse we can remove Claude-only ui without touching the page
    const cleanContent = content.cloneNode(true);

    // Remove screen reader/helper elements
    cleanContent
      .querySelectorAll("[data-find-omitted], .sr-only")
      .forEach((element) => element.remove());

    let text = cleanContent.innerText.trim();

    // Remove Claude user-message helper prefix
    if (role === "user") {
      text = text.replace(/^You said:\s*/i, "");
    }

    if (text) {
      messages.push({role,text});
    }
  });

  return messages;
}

window.RelayContextClaude = {
  scrape: scrapeClaude,
};
