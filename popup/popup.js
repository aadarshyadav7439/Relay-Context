const captureBtn = document.getElementById("captureBtn");

captureBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({active: true,currentWindow: true,});

  chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_CONTEXT" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError.message);
      return;
    }

    console.log("Relay received:", response);
  });
});
