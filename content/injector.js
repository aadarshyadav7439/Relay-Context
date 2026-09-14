(function () {
  const INPUT_SELECTORS = {
    chatgpt: ["#prompt-textarea", 'textarea[data-testid="prompt-textarea"]'],
    claude: ['div.ProseMirror[contenteditable="true"]'],
    gemini: ['div.ql-editor[contenteditable="true"]'],
    copilot: ["textarea#userInput", 'div[contenteditable="true"]'],
    grok: ['textarea[aria-label*="Ask Grok" i]', "textarea"],
  };

  const SEND_BUTTON_SELECTORS = {
    chatgpt: ['button[data-testid="send-button"]'],
    claude: ['button[aria-label="Send message"]'],
    gemini: ['button[aria-label="Send message"]'],
    copilot: ['button[data-testid="submit-button"]'],
    grok: ['button[aria-label*="Submit" i]'],
  };

  const MAX_ATTEMPTS = 20; // ~10 seconds of polling
  const POLL_INTERVAL = 500;
  const SEND_DELAY = 300; // give the framework a beat to register the text

  function findInputBox(platform) {
    const selectors = INPUT_SELECTORS[platform] || [];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function findSendButton(platform) {
    const selectors = SEND_BUTTON_SELECTORS[platform] || [];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  // Works for both React-controlled contenteditable divs and plain textareas.
  function insertText(el, text) {
    el.focus();

    const inserted =
      document.execCommand && document.execCommand("insertText", false, text);

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

  async function handleInjectionFailure(text, platform) {
    console.warn(
      `[RelayContext] Couldn't find the input box on ${platform}. Selectors may be outdated. Copying context to clipboard instead.`,
    );

    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.warn("[RelayContext] Clipboard write also failed:", err);
    }

    showFallbackBanner(platform);
  }

  function showFallbackBanner(platform) {
    const banner = document.createElement("div");
    banner.textContent = `RelayContext couldn't auto-inject on ${platform}. Your context was copied to the clipboard — paste it manually (Ctrl/Cmd+V).`;
    banner.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 999999;
      background: #1f1f1f;
      color: #fff;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: sans-serif;
      font-size: 13px;
      max-width: 320px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 8000);
  }

  async function tryInject(attempt = 0) {
    const { pendingContext, pendingTarget, autoSend } =
      await chrome.storage.local.get([
        "pendingContext",
        "pendingTarget",
        "autoSend",
      ]);

    if (!pendingContext || !pendingTarget) return;

    const currentPlatform =
      window.RelayContextPlatformDetector?.detectPlatform();
    if (currentPlatform !== pendingTarget) return; // wrong tab, not for us

    const inputBox = findInputBox(currentPlatform);

    if (!inputBox) {
      if (attempt < MAX_ATTEMPTS) {
        setTimeout(() => tryInject(attempt + 1), POLL_INTERVAL);
        return;
      }
      // Gave up finding the input box — fall back to clipboard + on-page notice.
      await handleInjectionFailure(pendingContext, currentPlatform);
      await chrome.storage.local.remove([
        "pendingContext",
        "pendingTarget",
        "autoSend",
      ]);
      return;
    }

    insertText(inputBox, pendingContext);

    if (autoSend) {
      setTimeout(() => {
        const sendBtn = findSendButton(currentPlatform);
        if (sendBtn && !sendBtn.disabled) sendBtn.click();
      }, SEND_DELAY);
    }

    // Prevent re-injecting if this script runs again (e.g. SPA navigation).
    await chrome.storage.local.remove([
      "pendingContext",
      "pendingTarget",
      "autoSend",
    ]);
  }

  tryInject();
})();
