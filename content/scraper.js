(() => {
  "use strict";

  function cleanTitle(title, platform) {
    let cleaned = title.trim();

    const suffixes = {
      chatgpt: [" - ChatGPT", " | ChatGPT", " — ChatGPT"],
      claude: [" - Claude", " | Claude", " — Claude"],
      gemini: [" - Gemini", " | Gemini", " — Gemini", "- Google Gemini"],
      copilot: [" - Copilot", " | Copilot", " — Copilot"],
      grok: [" - Grok", " | Grok", " — Grok"],
    };

    const platformSuffixes = suffixes[platform] || [];

    for (const suffix of platformSuffixes) {
      if (cleaned.endsWith(suffix)) {
        cleaned = cleaned.slice(0, -suffix.length).trim();
        break;
      }
    }
    return cleaned || "Untitled Conversation";
  }

  function fallbackScraper() {
    console.log("RelayContext: Using fallback scraper");

    const messages = [];

    const candidates = document.querySelectorAll(
      '[role="log"] [role="user"], ' +
        '[role="log"] [role="assistant"], ' +
        "[data-message-author-role], " +
        "article",
    );

    candidates.forEach((element) => {
      let role = element.getAttribute("data-message-author-role");

      if (!role) {
        role = element.getAttribute("role");
      }

      if (role !== "user" && role !== "assistant") {
        return;
      }

      const text = element.innerText?.trim();

      if (!text) return;

      messages.push({ role, text });
    });

    return messages;
  }

  function captureContext() {
    const platform =
      window.RelayContextPlatformDetector?.detectPlatform() || "unknown";

    let messages = [];

    if (platform === "chatgpt") {
      messages = window.RelayContextChatGPT?.scrape() || [];
    }
    if (platform === "gemini") {
      messages = window.RelayContextGemini?.scrape() || [];
    }
    if (platform === "claude") {
      messages = window.RelayContextClaude?.scrape() || [];
    }
    if (platform === "copilot") {
      messages = window.RelayContextCopilot?.scrape() || [];
    }
    if (platform === "grok") {
      messages = window.RelayContextGrok?.scrape() || [];
    }
    if (messages.length === 0) {
      messages = fallbackScraper();
    }

    const context = {
      platform,
      title: cleanTitle(document.title, platform),
      url: window.location.href,
      messages,
    };

    console.log("RelayContext captured:", context);

    return context;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== "CAPTURE_CONTEXT") {
      return;
    }

    try {
      const context = captureContext();

      // Process here (same content-script world as context-engine.js),
      // since popup.js can't reach window.RelayContextEngine itself.
      const mode = message.mode || "compact";
      const processed = window.RelayContextEngine?.processContext(
        context,
        mode,
      );

      if (!processed) {
        sendResponse({
          success: false,
          error: "No messages found to process.",
        });
        return;
      }

      sendResponse({
        success: true,
        data: processed,
      });
    } catch (error) {
      console.error("RelayContext capture failed:", error);

      sendResponse({
        success: false,
        error: error.message,
      });
    }

    return true;
  });
})();
