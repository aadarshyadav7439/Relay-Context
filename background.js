// RelayContext Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log("RelayContext Extension Installed successfully.");
});

//handles messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openTab") {
    //opening the new tab with the url
    chrome.tabs.create({ url: request.url }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });

    return true;//keeping hte message chnnel open for async response
  }
});