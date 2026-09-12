function detectPlatform() {
  const hostname = window.location.hostname;

  if (hostname === "chatgpt.com" || hostname === "chat.openai.com") {
    return "chatgpt";
  }
  if (hostname === "claude.ai") {
    return "claude";
  }
  if (hostname === "gemini.google.com") {
    return "gemini";
  }
  if(hostname === "copilot.microsoft.com" || hostname === "copilot.com") {
    return "copilot";
  }
  if (hostname === "grok.com"){
    return "grok";
  }

  return "unknown";
}

window.RelayContextPlatformDetector = {
  detectPlatform
};