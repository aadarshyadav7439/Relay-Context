(() => {
  "use strict";

  const pageContext = {
    title: document.title,
    url: window.location.href,
    text: document.body.innerText.trim()
  };

  console.log("Relay captured context:", pageContext);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "CAPTURE_CONTEXT") {
      sendResponse({
        success: true,
        data: pageContext
      });
    }
  });
})();