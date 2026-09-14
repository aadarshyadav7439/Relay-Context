const captureBtn = document.getElementById("captureBtn");
const copyBtn = document.getElementById("copyBtn");
const exportBtn = document.getElementById("exportBtn");
const statusCard = document.getElementById("statusCard");
const statusIcon = document.getElementById("statusIcon");
const statusTitle = document.getElementById("statusTitle");
const statusMeta = document.getElementById("statusMeta");
const targetBtns = document.querySelectorAll(".target-btn");

// Holds the captured text in memory for Copy — not rendered in the DOM,
// since the user only needs to see status, not the raw content.
let capturedText = "";

function setStatus({ title, mode, messageCount, filled }) {
  if (filled) {
    statusCard.classList.remove("status-empty");
    statusCard.classList.add("status-filled");
    statusIcon.textContent = "✓";
    statusTitle.textContent = title || "Context captured";
    statusMeta.textContent = `${mode === "compact" ? "Compact" : "Full"} · ${messageCount ?? "?"} messages`;
  } else {
    statusCard.classList.remove("status-filled");
    statusCard.classList.add("status-empty");
    statusIcon.textContent = "○";
    statusTitle.textContent = "No context captured yet";
    statusMeta.textContent = "";
  }
}

function enableActionButtons() {
  copyBtn.disabled = false;
  exportBtn.disabled = false;
  targetBtns.forEach((btn) => (btn.disabled = false));
}

function disableActionButtons() {
  copyBtn.disabled = true;
  exportBtn.disabled = true;
  targetBtns.forEach((btn) => (btn.disabled = true));
}

captureBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const mode = document.querySelector('input[name="mode"]:checked').value;

  chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_CONTEXT", mode }, async (response) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError.message);
      return;
    }
    if (!response?.success) {
      console.error("RelayContext failed to capture page:", response?.error);
      setStatus({ filled: false });
      disableActionButtons();
      return;
    }

    const context = response.data;
    capturedText = context.text;

    await chrome.storage.local.set({ capturedContext: context });

    setStatus({
      title: context.title,
      mode,
      messageCount: context.messages?.length ?? context.processedMessages?.length,
      filled: true,
    });

    enableActionButtons();
  });
});

copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(capturedText);
  copyBtn.textContent = "Copied!";
  setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
});

exportBtn.addEventListener("click", async () => {
  const { capturedContext } = await chrome.storage.local.get("capturedContext");
  if (!capturedContext?.stateFile) return;

  const blob = new Blob([capturedContext.stateFile], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relaycontext-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

targetBtns.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const { capturedContext } = await chrome.storage.local.get("capturedContext");
    if (!capturedContext) return;

    const autoSend = document.getElementById("autoSendToggle").checked;

    await chrome.storage.local.set({
      pendingContext: capturedContext.text,
      pendingTarget: btn.dataset.platform,
      autoSend,
    });

    chrome.tabs.create({ url: btn.dataset.url });
  });
});

// Loads saved context, but only shows it if it actually belongs to the
// current tab — otherwise you'd see stale status from a different page.
async function loadSavedContext() {
  const result = await chrome.storage.local.get("capturedContext");
  if (!result.capturedContext) return;

  const context = result.capturedContext;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab?.url !== context.url) {
    setStatus({ filled: false });
    disableActionButtons();
    return;
  }

  capturedText = context.text;

  setStatus({
    title: context.title,
    mode: context.mode,
    messageCount: context.messages?.length ?? context.processedMessages?.length,
    filled: true,
  });

  enableActionButtons();
}

loadSavedContext();