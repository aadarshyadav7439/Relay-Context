const captureBtn = document.getElementById("captureBtn");

const pageTitle = document.getElementById("pageTitle");
const pageUrl = document.getElementById("pageUrl");
const pageText = document.getElementById("pageText");

captureBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({active: true,currentWindow: true,});
  //scraper ko cature karne ka message bhejenge taki response mil sake
  chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_CONTEXT" }, async (response) => {
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
  });
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
}
//context ui me load karwa lenge
loadSavedContext();
