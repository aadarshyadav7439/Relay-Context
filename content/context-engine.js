function normalizeWhitespace(text) {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

function findContentRoot() {
  return (
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.querySelector('[role="main"]') ||
    document.body
  );
}

function extractMeaningfulContent() {
  const root = findContentRoot();

  const elements = root.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li, pre, blockquote",);

  const parts = [];

  elements.forEach((element) => {
    // Ignore elements inside obvious page noise
    if (element.closest("nav, header, footer, aside, script, style, [hidden]")) {
      return;
    }

    const text = element.innerText?.trim();

    if (!text || text.length < 20) {
      return;
    }

    const tag = element.tagName.toLowerCase();

    if (tag.startsWith("h")){
      parts.push(`[Heading] ${text}`);
    } else if (tag === "pre") {
      parts.push(`[Code]\n${text}`);
    } else {
      parts.push(text);
    }
  });

  return normalizeWhitespace(parts.join("\n\n"));
}

//hum engine ko webpage ke baaki extension scripts ke liye accessible bana rahe hain
window.RelayContextEngine = {
  normalizeWhitespace,
  extractMeaningfulContent,
};
