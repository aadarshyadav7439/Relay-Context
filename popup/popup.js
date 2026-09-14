const captureBtn = document.getElementById("captureBtn");
const copyBtn = document.getElementById("copyBtn");
const exportBtn = document.getElementById("exportBtn");
const pageTitle = document.getElementById("pageTitle");
const pageUrl = document.getElementById("pageUrl");
const pageText = document.getElementById("pageText");
const targetBtns = document.querySelectorAll(".target-btn");

function enableActionButtons() {
  copyBtn.disabled = false;
  exportBtn.disabled = false;
  targetBtns.forEach((btn) => (btn.disabled = false));
}

captureBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({active: true,currentWindow: true,});

  const mode = document.querySelector('input[name="mode"]:checked').value;
  //scraper ko cature karne ka message bhejenge taki response mil sake
  chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_CONTEXT", mode }, async (response) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError.message);
      return;
    }
    if(!response?.success){
      console.error("RelayContext failed to capture Page.");
      return;
    }

    const context = response.data;
    //extracted data ko localStorage me save as capturedContext
    await chrome.storage.local.set({
      capturedContext: context
    });

    pageTitle.textContent = context.title;
    pageUrl.textContent = context.url;
    pageText.textContent = context.text;

    //buttons enable once context is available
    enableActionButtons();
  });
});

copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(pageText.textContent);
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

//loads the already capturedContentfrom local Storage if present
async function loadSavedContext() {
  const result = await chrome.storage.local.get("capturedContext");

  if (!result.capturedContext) {
    return;
  }

  const context = result.capturedContext;

  pageTitle.textContent = context.title;
  pageUrl.textContent = context.url;
  pageText.textContent = context.text;

  //enable buttons when the content is available
  enableActionButtons();
}
//redirect platforms
targetBtns.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const { capturedContext } = await chrome.storage.local.get("capturedContext");
    if (!capturedContext) return;

    // Stash what to inject + where, so injector.js (on the target site) can pick it up.
    await chrome.storage.local.set({
      pendingContext: capturedContext.text,
      pendingTarget: btn.dataset.platform,
    });

    chrome.tabs.create({ url: btn.dataset.url });
  });
});

//context ui me load karwa lenge
loadSavedContext();
