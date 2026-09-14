(function () {
  const INPUT_SELECTORS = {
    chatgpt: ['#prompt-textarea', 'textarea[data-testid="prompt-textarea"]'],
    claude: ['div.ProseMirror[contenteditable="true"]'],
    gemini: ['div.ql-editor[contenteditable="true"]'],
    copilot: ['textarea#userInput', 'div[contenteditable="true"]'],
    grok: ['textarea[aria-label*="Ask Grok" i]', 'textarea'],
  };

  const MAX_ATTEMPTS = 20;   // ~10 seconds of polling
  const POLL_INTERVAL = 500;

  function findInputBox(platform) {
    const selectors = INPUT_SELECTORS[platform] || [];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  // Works for both React-controlled contenteditable divs and plain textareas.
  function insertText(el, text) {
    el.focus();

    const inserted = document.execCommand && document.execCommand("insertText", false, text);

    if (!inserted) {
      // Fallback for browsers/elements where execCommand doesn't work.
      if ("value" in el) {
        el.value = text;
      } else {
        el.textContent = text;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  async function tryInject(attempt = 0) {
    const { pendingContext, pendingTarget } = await chrome.storage.local.get([
      "pendingContext","pendingTarget",
    ]);

    if (!pendingContext || !pendingTarget) return;

    const currentPlatform = window.RelayContextPlatformDetector?.detectPlatform();
    if (currentPlatform !== pendingTarget) return; // wrong tab, not for us

    const inputBox = findInputBox(currentPlatform);

    if (!inputBox) {
      if (attempt < MAX_ATTEMPTS) {
        setTimeout(() => tryInject(attempt + 1), POLL_INTERVAL);
      }
      return;
    }

    insertText(inputBox, pendingContext);

    // Prevent re-injecting if this script runs again (e.g. SPA navigation).
    await chrome.storage.local.remove(["pendingContext", "pendingTarget"]);
  }

  tryInject();
})();