// RelayContext Popup Controller

document.addEventListener("DOMContentLoaded", () => {
  let scrapedData = null;
  let capturedContext = null;
  let customPreamble = "";
  let defaultTarget = "chatgpt";
  let activeMode = "compact";

  const DEFAULT_SETTINGS = {
    promptPreamble:
      "[System Instruction: You are continuing a conversation that began with another AI. The conversation context below contains the previous discussion, goals, decisions, technical details, and relevant information. Read it carefully and continue from the current state.]",
    defaultTarget: "chatgpt",
    autoSend: true,
    smartCompress: true,
  };

  const TARGET_URLS = {
    chatgpt: "https://chatgpt.com",
    claude: "https://claude.ai",
    gemini: "https://gemini.google.com",
    copilot: "https://copilot.microsoft.com",
    grok: "https://grok.com",
  };

  const detectedPanel = document.getElementById("detected-panel");
  const emptyPanel = document.getElementById("empty-panel");
  const settingsPanel = document.getElementById("settings-panel");
  const settingsToggleBtn = document.getElementById("settings-toggle-btn");
  const settingsCloseBtn = document.getElementById("settings-close-btn");
  const platformBadge = document.getElementById("platform-badge");
  const detectedPlatformText = document.getElementById(
    "detected-platform-text",
  );
  const chatTitle = document.getElementById("chat-title");
  const messageCountBadge = document.getElementById("message-count-badge");
  const charCountBadge = document.getElementById("char-count-badge");
  const segmentButtons = document.querySelectorAll(".segment-btn");
  const aiStatusBox = document.getElementById("ai-status-box");
  const aiStatusText = document.getElementById("ai-status-text");
  const outlineTrigger = document.getElementById("outline-trigger");
  const manualTrigger = document.getElementById("manual-trigger");
  const manualContent = document.getElementById("manual-content");
  const manualInput = document.getElementById("manual-input");
  const copyManualBtn = document.getElementById("copy-manual-btn");
  const preambleInput = document.getElementById("preamble-input");
  const defaultTargetSelect = document.getElementById("default-target");
  const saveSettingsBtn = document.getElementById("save-settings-btn");
  const resetSettingsBtn = document.getElementById("reset-settings-btn");
  const autoSendToggle = document.getElementById("auto-send-toggle");
  const autoCompressToggle = document.getElementById("auto-compress-toggle");
  const compressionModeSelect = document.getElementById("compression-mode");
  const exportStateBtn = document.getElementById("export-state-btn");
  const oneClickResumeBtn = document.getElementById("one-click-resume-btn");
  const copyPromptBtn = document.getElementById("copy-prompt-btn");
  const targetButtons = document.querySelectorAll(".target-btn");
  const toast = document.getElementById("toast");
  const limitWarning = document.getElementById("limit-warning");
  const turnsContainer = document.getElementById("turns-container");
  const turnSearch = document.getElementById("turn-search");
  const selectAllTurns = document.getElementById("select-all-turns");

  const showToast = (message) => {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  };

  const showEmptyUI = () => {
    detectedPanel?.classList.add("hidden");
    emptyPanel?.classList.remove("hidden");
  };

  const showDetectedUI = () => {
    emptyPanel?.classList.add("hidden");
    detectedPanel?.classList.remove("hidden");
  };

  // ============================================================
  // SETTINGS
  // ============================================================

  const loadSettings = async () => {
    const result = await chrome.storage.local.get("relaySettings");

    const settings = {
      ...DEFAULT_SETTINGS,
      ...(result.relaySettings || {}),
    };

    customPreamble = settings.promptPreamble;
    defaultTarget = settings.defaultTarget;

    if (preambleInput) {
      preambleInput.value = settings.promptPreamble;
    }

    if (defaultTargetSelect) {
      defaultTargetSelect.value = settings.defaultTarget;
    }

    if (autoSendToggle) {
      autoSendToggle.checked = settings.autoSend;
    }

    if (autoCompressToggle) {
      autoCompressToggle.checked = settings.smartCompress;
    }

    if (compressionModeSelect) {
      compressionModeSelect.value = settings.smartCompress ? "compact" : "full";
    }
  };

  const saveSettings = async () => {
    const settings = {
      promptPreamble:
        preambleInput?.value.trim() || DEFAULT_SETTINGS.promptPreamble,

      defaultTarget:
        defaultTargetSelect?.value || DEFAULT_SETTINGS.defaultTarget,

      autoSend: autoSendToggle?.checked ?? DEFAULT_SETTINGS.autoSend,

      smartCompress:
        autoCompressToggle?.checked ?? DEFAULT_SETTINGS.smartCompress,
    };

    await chrome.storage.local.set({
      relaySettings: settings,
    });

    customPreamble = settings.promptPreamble;
    defaultTarget = settings.defaultTarget;

    showToast("Settings saved!");
  };

  settingsToggleBtn?.addEventListener("click", () => {
    settingsPanel?.classList.remove("hidden");
    loadSettings();
  });

  settingsCloseBtn?.addEventListener("click", () => {
    settingsPanel?.classList.add("hidden");
  });

  saveSettingsBtn?.addEventListener("click", async () => {
    await saveSettings();
    settingsPanel?.classList.add("hidden");
  });

  resetSettingsBtn?.addEventListener("click", async () => {
    if (!confirm("Reset all settings to defaults?")) {
      return;
    }

    await chrome.storage.local.set({
      relaySettings: DEFAULT_SETTINGS,
    });

    await loadSettings();

    showToast("Settings reset to defaults");
  });

  // ============================================================
  // AI STATUS
  // ============================================================

  const updateAIStatus = (text, warning = false) => {
    if (!aiStatusText || !aiStatusBox) {
      return;
    }

    aiStatusText.textContent = text;
    aiStatusBox.classList.toggle("warning", warning);
  };

  const checkChromeAI = async () => {
    if (window.ai && window.ai.assistant) {
      updateAIStatus("Local AI (Gemini Nano) detected!", false);
    } else {
      updateAIStatus(
        "Local AI not active. Falling back to Smart Compactor.",
        true,
      );
    }
  };

  // ============================================================
  // MODE SELECTION
  // ============================================================

  segmentButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      segmentButtons.forEach((item) => {
        item.classList.remove("active");
      });

      btn.classList.add("active");

      activeMode = btn.dataset.mode || "compact";

      if (activeMode === "ai") {
        aiStatusBox?.classList.remove("hidden");
        checkChromeAI();
      } else {
        aiStatusBox?.classList.add("hidden");
      }

      updateCounts();
    });
  });

  // ============================================================
  // SELECTED MESSAGES
  // ============================================================

  const getSelectedMessages = () => {
    if (!scrapedData?.messages?.length) {
      return [];
    }

    const checkboxes = document.querySelectorAll(".turn-checkbox");

    const selectedMessages = [];

    checkboxes.forEach((checkbox) => {
      if (!checkbox.checked) {
        return;
      }

      const index = Number.parseInt(checkbox.dataset.index, 10);

      const userMessage = scrapedData.messages[index];

      if (!userMessage) {
        return;
      }

      selectedMessages.push(userMessage);

      const assistantMessage = scrapedData.messages[index + 1];

      if (assistantMessage?.role === "assistant") {
        selectedMessages.push(assistantMessage);
      }
    });

    return selectedMessages;
  };

  // ============================================================
  // COMPACTING
  // ============================================================

  const getCompactMessages = (messages) => {
    if (!messages.length) {
      return [];
    }

    if (messages.length <= 10) {
      return messages;
    }

    const result = [messages[0]];

    const codeBlocks = [];
    const decisions = [];

    const codeRegex = /```[\s\S]*?```/g;

    const decisionRegex =
      /\b(decided|implemented|fixed|changed|refactored|optimized|rewrote|switched|moved|added|removed|updated|configured|replaced|selected|chose)\b/i;

    for (let i = 1; i < messages.length - 1; i++) {
      const message = messages[i];

      const matches = message.text.match(codeRegex);

      if (matches) {
        matches.forEach((code) => {
          if (!codeBlocks.includes(code)) {
            codeBlocks.push(code);
          }
        });
      }

      if (decisionRegex.test(message.text)) {
        const firstLine = message.text
          .split("\n")
          .map((line) => line.trim())
          .find(Boolean);

        if (firstLine && !decisions.includes(firstLine)) {
          decisions.push(firstLine.substring(0, 300));
        }
      }
    }

    if (codeBlocks.length) {
      result.push({
        role: "system",
        text:
          "[Technical Context: Relevant code snippets]\n\n" +
          codeBlocks.slice(0, 8).join("\n\n"),
      });
    }

    if (decisions.length) {
      result.push({
        role: "system",
        text:
          "[Decision Log]\n" +
          decisions
            .slice(0, 8)
            .map((item) => `• ${item}`)
            .join("\n"),
      });
    }

    messages.slice(-5).forEach((message) => {
      const exists = result.some(
        (item) => item.role === message.role && item.text === message.text,
      );

      if (!exists) {
        result.push(message);
      }
    });

    return result;
  };

  // ============================================================
  // COUNTS
  // ============================================================

  const updateCounts = () => {
    if (!scrapedData || !messageCountBadge || !charCountBadge) {
      return;
    }

    const selectedMessages = getSelectedMessages();

    const selectedTurns = document.querySelectorAll(
      ".turn-checkbox:checked",
    ).length;

    const processedMessages =
      activeMode === "full"
        ? selectedMessages
        : getCompactMessages(selectedMessages);

    const chars = processedMessages.reduce(
      (total, message) => total + (message.text?.length || 0),
      0,
    );

    messageCountBadge.textContent = `${selectedTurns} turns selected`;

    charCountBadge.textContent = `~${chars.toLocaleString()} chars`;

    if (selectAllTurns) {
      const checkboxes = Array.from(
        document.querySelectorAll(".turn-checkbox"),
      );

      const visibleCheckboxes = checkboxes.filter(
        (checkbox) =>
          !checkbox.closest(".turn-item")?.classList.contains("hidden"),
      );

      const allChecked =
        visibleCheckboxes.length > 0 &&
        visibleCheckboxes.every((checkbox) => checkbox.checked);

      const someChecked = visibleCheckboxes.some(
        (checkbox) => checkbox.checked,
      );

      selectAllTurns.checked = allChecked;

      selectAllTurns.indeterminate = someChecked && !allChecked;
    }
  };

  // ============================================================
  // TURN LIST
  // ============================================================

  const renderTurnsList = () => {
    if (!turnsContainer || !scrapedData?.messages) {
      return;
    }

    turnsContainer.innerHTML = "";

    let turnNumber = 1;

    scrapedData.messages.forEach((message, index) => {
      if (message.role !== "user") {
        return;
      }

      const item = document.createElement("div");

      item.className = "turn-item";
      item.dataset.index = index;
      item.dataset.text = message.text.toLowerCase();

      const checkbox = document.createElement("input");

      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.className = "turn-checkbox";
      checkbox.dataset.index = index;
      checkbox.id = `turn-cb-${index}`;

      checkbox.addEventListener("change", updateCounts);

      const text = document.createElement("span");

      text.className = "turn-text";

      text.textContent = `${turnNumber}. ${message.text}`;

      text.addEventListener("click", () => {
        checkbox.checked = !checkbox.checked;

        updateCounts();
      });

      const meta = document.createElement("span");

      meta.className = "turn-meta";

      let totalLength = message.text.length;

      if (scrapedData.messages[index + 1]?.role === "assistant") {
        totalLength += scrapedData.messages[index + 1].text.length;
      }

      meta.textContent = `${totalLength} chars`;

      item.appendChild(checkbox);
      item.appendChild(text);
      item.appendChild(meta);

      turnsContainer.appendChild(item);

      turnNumber++;
    });

    updateCounts();
  };

  selectAllTurns?.addEventListener("change", (event) => {
    document
      .querySelectorAll(".turn-item:not(.hidden) .turn-checkbox")
      .forEach((checkbox) => {
        checkbox.checked = event.target.checked;
      });

    updateCounts();
  });

  turnSearch?.addEventListener("input", (event) => {
    const query = event.target.value.toLowerCase().trim();

    document.querySelectorAll(".turn-item").forEach((item) => {
      item.classList.toggle("hidden", !item.dataset.text.includes(query));
    });

    updateCounts();
  });

  // ============================================================
  // BUILD CONTINUATION PROMPT
  // ============================================================

  const buildContinuationPrompt = async () => {
    const messages = getSelectedMessages();

    if (!messages.length) {
      alert("Please select at least one turn.");

      return "";
    }

    let processedMessages = messages;

    if (activeMode === "compact") {
      processedMessages = getCompactMessages(messages);
    }

    // AI MODE
    if (activeMode === "ai") {
      if (!window.ai?.assistant) {
        updateAIStatus("Local AI unavailable. Falling back to Compact.", true);

        processedMessages = getCompactMessages(messages);
      } else {
        try {
          updateAIStatus("Summarizing with Gemini Nano...", false);

          const rawText = messages
            .map((message) => `${message.role}: ${message.text}`)
            .join("\n\n");

          const session = await window.ai.assistant.create({
            signal: AbortSignal.timeout(30000),
          });

          const summary = await session.prompt(`
You are a conversational AI context summarizer.

Create a concise but complete structured state of the conversation.

Include:
1. Core Goal
2. Key Constraints
3. Decisions Made
4. Last Active Topic
5. Code Snippets
6. Open Questions
7. Next Steps

Preserve important technical details and do not add information that is not present in the conversation.

CONVERSATION:
${rawText}
`);

          session.destroy();

          if (summary?.trim()) {
            updateAIStatus("Summarized with Gemini Nano.", false);

            return `${customPreamble}

=== CONVERSATION SUMMARY START ===
${summary.trim()}
=== CONVERSATION SUMMARY END ===

Continue the conversation based on this summary.`;
          }
        } catch (error) {
          console.warn("RelayContext: Local AI summarization failed", error);

          updateAIStatus("AI unavailable. Falling back to Compact.", true);

          processedMessages = getCompactMessages(messages);
        }
      }
    }

    const transcript = processedMessages
      .map((message) => {
        if (message.role === "system") {
          return message.text;
        }

        return `${
          message.role === "user" ? "User" : "Assistant"
        }: ${message.text}`;
      })
      .join("\n---\n");

    return `${customPreamble}

=== CONVERSATION TRANSCRIPT START ===
${transcript.trim()}
=== CONVERSATION TRANSCRIPT END ===

Please review the transcript above and continue the conversation based on the current state.`;
  };

  // ============================================================
  // PREPARE BRIDGE
  // ============================================================

  const prepareBridge = async (target) => {
    const promptText = await buildContinuationPrompt();

    if (!promptText) {
      return false;
    }

    await chrome.storage.local.set({
      pendingContext: promptText,
      pendingTarget: target,

      // IMPORTANT:
      // RelayContext injector.js uses "autoSend"
      autoSend: autoSendToggle?.checked ?? DEFAULT_SETTINGS.autoSend,
    });

    return true;
  };

  // ============================================================
  // COPY PROMPT
  // ============================================================

  copyPromptBtn?.addEventListener("click", async () => {
    const promptText = await buildContinuationPrompt();

    if (!promptText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(promptText);

      showToast("Continuation prompt copied!");
    } catch (error) {
      console.error("RelayContext clipboard copy failed:", error);

      showToast("Failed to copy.");
    }
  });

  // ============================================================
  // ONE CLICK RESUME
  // ============================================================

  oneClickResumeBtn?.addEventListener("click", async () => {
    if (!defaultTarget || defaultTarget === "none") {
      alert("Set a default target in Settings first!");

      return;
    }

    if (!(await prepareBridge(defaultTarget))) {
      return;
    }

    showToast("One-click resume initiated!");

    chrome.tabs.create({
      url: TARGET_URLS[defaultTarget],
    });
  });

  // ============================================================
  // TARGET BUTTONS
  // ============================================================

  targetButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const target =
        button.dataset.platform ||
        Array.from(button.classList).find((item) => TARGET_URLS[item]);

      const url = button.dataset.url || TARGET_URLS[target];

      if (!target || !url) {
        return;
      }

      if (await prepareBridge(target)) {
        button.textContent = "Opening...";

        setTimeout(() => {
          chrome.tabs.create({
            url,
          });
        }, 300);
      } else {
        chrome.tabs.create({
          url,
        });
      }
    });
  });

  // ============================================================
  // EXPORT STATE
  // ============================================================

  exportStateBtn?.addEventListener("click", async () => {
    if (!scrapedData) {
      alert("No conversation to export!");

      return;
    }

    const messages = getSelectedMessages();

    if (!messages.length) {
      alert("Please select at least one turn.");

      return;
    }

    const stateFile = {
      version: "1.0",
      format: "RelayContext State File",
      exportedAt: new Date().toISOString(),

      platform: scrapedData.platform,

      title: scrapedData.title,

      url: scrapedData.url,

      statistics: {
        totalTurns: messages.filter((message) => message.role === "user")
          .length,

        totalMessages: messages.length,

        totalCharacters: messages.reduce(
          (sum, message) => sum + message.text.length,
          0,
        ),
      },

      transcript: messages,
    };

    const blob = new Blob([JSON.stringify(stateFile, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");

    anchor.href = url;

    anchor.download = `relaycontext-${scrapedData.platform}-${Date.now()}.json`;

    document.body.appendChild(anchor);

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(url);

    showToast("Exported!");
  });

  // ============================================================
  // MANUAL CONTEXT
  // ============================================================

  copyManualBtn?.addEventListener("click", async () => {
    const value = manualInput?.value.trim();

    if (!value) {
      alert("Paste some text first.");

      return;
    }

    const wrapped = `${customPreamble}

=== MANUAL CONTEXT START ===
${value}
=== MANUAL CONTEXT END ===

Please review this context and continue the conversation based on it.`;

    try {
      await navigator.clipboard.writeText(wrapped);

      showToast("Manual context copied!");

      manualInput.value = "";
    } catch (error) {
      console.error("RelayContext manual copy failed:", error);

      showToast("Failed to copy.");
    }
  });

  // ============================================================
  // ACCORDIONS
  // ============================================================

  outlineTrigger?.addEventListener("click", () => {
    outlineTrigger.closest(".accordion")?.classList.toggle("expanded");
  });

  manualTrigger?.addEventListener("click", () => {
    if (!manualContent) {
      return;
    }

    const hidden = manualContent.classList.contains("hidden");

    manualContent.classList.toggle("hidden", !hidden);

    const arrow = manualTrigger.querySelector(".arrow");

    if (arrow) {
      arrow.textContent = hidden ? "▲" : "▼";
    }
  });

  // ============================================================
  // RENDER SCRAPED DATA
  // ============================================================

  const renderScrapedUI = () => {
    if (!scrapedData) {
      return;
    }

    showDetectedUI();

    if (platformBadge) {
      platformBadge.className = `status-badge ${scrapedData.platform}`;
    }

    if (detectedPlatformText) {
      detectedPlatformText.textContent = `Active: ${scrapedData.platform}`;
    }

    if (chatTitle) {
      chatTitle.textContent = scrapedData.title || "Untitled Conversation";
    }

    if (limitWarning) {
      limitWarning.classList.toggle("hidden", !scrapedData.limitDetected);
    }

    renderTurnsList();
  };

  // ============================================================
  // INITIAL SCRAPE
  // ============================================================

  const initScrape = async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        showEmptyUI();
        return;
      }

      const response = await new Promise((resolve) => {
        chrome.tabs.sendMessage(
          tab.id,
          {
            type: "CAPTURE_CONTEXT",
            mode: activeMode === "full" ? "full" : "compact",
          },
          (result) => {
            if (chrome.runtime.lastError) {
              resolve(null);
              return;
            }

            resolve(result);
          },
        );
      });

      if (response?.success && response.data) {
        capturedContext = response.data;

        scrapedData = {
          platform: response.data.platform,

          title: response.data.title,

          url: response.data.url,

          messages: response.data.messages || [],
        };

        renderScrapedUI();

        return;
      }

      showEmptyUI();
    } catch (error) {
      console.error("RelayContext popup scrape failed:", error);

      showEmptyUI();
    }
  };

  // ============================================================
  // INITIALIZE
  // ============================================================

  const initialize = async () => {
    await loadSettings();

    const stored = await chrome.storage.local.get("capturedContext");

    if (stored.capturedContext) {
      capturedContext = stored.capturedContext;
    }

    const activeSegment = document.querySelector(".segment-btn.active");

    if (activeSegment) {
      activeMode = activeSegment.dataset.mode || activeMode;
    }

    await initScrape();
  };

  initialize();
});
