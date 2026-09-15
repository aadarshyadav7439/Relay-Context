// RelayContext Smart Context Engine
//works -> cleaning,validating compacting, summarize and generate
(function () {
  "use strict";

  // 1. Text ko clean karna
  function normalizeWhitespace(text) {
    if (typeof(text) !== "string"){
      return "";
    }
    return text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function cleanMessageText(text) {
    return normalizeWhitespace(text);
  }
  // 2. Raw scraped messages → clean standardized messages karega
  function formatMessages(messages) {
    if (!Array.isArray(messages)) {
      return [];
    }
    const seen = new Set();
    return messages
      .map((message) => {
        if (!message || typeof message !== "object") {
          return null;
        }
        const role =
          message.role === "user"
            ? "user"
            : message.role === "assistant"
              ? "assistant"
              : message.role === "system"? "system": null;
        const text = cleanMessageText(message.text);

        if (!role || !text) {
          return null;
        }
        return {
          role,text
        };
      })
      .filter(Boolean)
      .filter((message) => {
        // Prevent exact duplicate messages caused by duplicated DOM nodes / fallback scraping.
        const key = `${message.role}:${message.text}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }
// 3. FULL TRANSCRIPT for the full mode
  function formatFullContext(messages) {
    const cleanedMessages = formatMessages(messages);

    return cleanedMessages
      .map((message) => {
        const label =
          message.role === "user"
            ? "User"
            : message.role === "assistant"? "Assistant": "System";
        return `${label}: ${message.text}`;
      })
      .join("\n---\n");
  }
// 4. CODE EXTRACTION
  function extractCodeBlocks(messages) {
    const codeBlocks = [];
    const seen = new Set();
    const codeBlockRegex = /```[\s\S]*?```/g;
    messages.forEach((message) => {
      const matches = message.text.match(codeBlockRegex);
      if (!matches) {
        return;
      }
      matches.forEach((code) => {
        const cleanedCode = code.trim();
        if (!cleanedCode || seen.has(cleanedCode)) {
          return;
        }
        seen.add(cleanedCode);
        codeBlocks.push(cleanedCode);
      });
    });
    return codeBlocks;
  }
  // 5. TECHNICAL DECISION EXTRACTION
  function extractTechnicalDecisions(messages) {
    const decisions = [];
    const seen = new Set();
    const decisionRegex =/\b(decided|implemented|fixed|changed|refactored|optimized|rewrote|switched|moved|added|removed|updated|configured|replaced|selected|chose)\b/i;

    messages.forEach((message) => {
      if (!decisionRegex.test(message.text)) {
        return;
      }
      const firstLine = message.text
        .split("\n")
        .map((line) => line.trim())
        .find(Boolean);
      if (!firstLine) {
        return;
      }
      const decision = firstLine.substring(0, 300);
      if (seen.has(decision)) {
        return;
      }
      seen.add(decision);
      decisions.push(decision);
    });

    return decisions;
  }
  
  // 6. COMPACT TRANSCRIPT (JAb mode == compact hoga)

  function compactTranscript(messages) {
    const cleanedMessages = formatMessages(messages);
    if (cleanedMessages.length === 0) {
      return [];
    }
    // Short conversations me no need of compression.
    if (cleanedMessages.length <= 10) {
      return cleanedMessages;
    }
    const result = [];
    // Preserve the initial goal/context.
    result.push(cleanedMessages[0]);
    const codeBlocks = extractCodeBlocks(cleanedMessages);
    const technicalDecisions = extractTechnicalDecisions(cleanedMessages);
    // Preserve important technical information.
    if (codeBlocks.length > 0) {
      result.push({
        role: "system",
        text:
          "[Technical Context: Relevant code snippets]\n\n" +
          codeBlocks.slice(0, 8).join("\n\n"),
      });
    }

    if (technicalDecisions.length > 0) {
      result.push({
        role: "system",
        text:
          "[Decision Log]\n" +
          technicalDecisions
            .slice(0, 8)
            .map((decision) => `• ${decision}`)
            .join("\n"),
      });
    }

    // Preserve the most recent messages because they represent the current state of the conversation.
    const recentMessages = cleanedMessages.slice(-5);
    recentMessages.forEach((message) => {
      const alreadyIncluded = result.some(
        (existing) =>
          existing.role === message.role &&
          existing.text === message.text,
      );

      if (!alreadyIncluded) {
        result.push(message);
      }
    });
    return result;
  }

  // 7. COMPRESSION STATISTICS

  function calculateTextSize(messages) {
    if (!Array.isArray(messages)) {
      return 0;
    }
    return messages.reduce((total, message) => total + (message.text?.length || 0),0);
  }

  function getCompressionRatio(original, condensed) {
    if (!Array.isArray(original) || !Array.isArray(condensed)) {
      return "0.0";
    }

    const originalSize = calculateTextSize(original);
    const condensedSize = calculateTextSize(condensed);
    if (originalSize === 0) {
      return "0.0";
    }

    const ratio = (1 - condensedSize / originalSize) * 100;
    return Math.max(0, ratio).toFixed(1);
  }

// 8. LoCAL_ AI SUMMARIZATION
  async function summarizeWithLocalAI(messages) {
    try {
      if (!window.ai || !window.ai.assistant) {
        return null;
      }

      const transcript = formatMessages(messages);
      if (transcript.length === 0) {
        return null;
      }

      const rawText = transcript
        .map((message) => `${message.role}: ${message.text}`)
        .join("\n\n");

      const session = await window.ai.assistant.create({
        signal: AbortSignal.timeout(30000),
      });

      const systemPrompt = `
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

Preserve important technical details, requirements, decisions,
and unfinished work.

Do not add information that is not present in the conversation.

Return the result as structured Markdown.
`;

      const summary = await session.prompt(
        `${systemPrompt} 
        CONVERSATION: 
        ${rawText}`,
      );

      session.destroy();
      if (!summary || typeof summary !== "string") {
        return null;
      }
      return {
        mode: "ai",
        content: summary.trim(),
        metadata: {
          compressed: true,
          localAI: true,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.warn("RelayContext: Local AI summarization unavailable", error);
      return null;
    }
  }
  // 9. COMPRESSION DECISION
  function shouldCompress(messages) {
    return Array.isArray(messages) && messages.length > 10;
  }
//10. STATE FILE FOR EXPORT
  function createStateFile(messages, mode = "compact") {
    const cleanedMessages = formatMessages(messages);

    const transcript =
      mode === "compact" ? compactTranscript(cleanedMessages) : cleanedMessages;

    const stateFile = {
      version: "1.0",
      format: "RelayContext State File",
      exportedAt: new Date().toISOString(),
      statistics: {
        originalTurns: cleanedMessages.length,
        condensedTurns: transcript.length,
        compressionMode: mode,
        compressionRatio: getCompressionRatio(cleanedMessages, transcript),
      },
      transcript,
    };

    return JSON.stringify(stateFile, null, 2);
  }

  // 11. CONTEXT PROMPT (will be passed to other ai platforms)
  function buildContextPrompt(messages, mode = "compact", preamble) {
    const cleanedMessages = formatMessages(messages);
    if (cleanedMessages.length === 0) {
      return "";
    }
    const systemPreamble =
      preamble ||
      `[System Instruction: You are continuing a conversation that began with another AI. The conversation context below contains the previous discussion, goals, decisions, and relevant information. Read it carefully and continue from the current state.]`;

    const transcriptMessages =
      mode === "compact"? compactTranscript(cleanedMessages): cleanedMessages;
    const transcript = transcriptMessages
      .map((message) => {
        if (message.role === "system") {
          return message.text;
        }
        const label = message.role === "user" ? "User" : "Assistant";
        return `${label}: ${message.text}`;
      })
      .join("\n---\n");

    return `${systemPreamble}
=== CONVERSATION TRANSCRIPT START ===
${transcript.trim()}
=== CONVERSATION TRANSCRIPT END ===

Continue the conversation based on the context above.`;
  }

  // 12. MAIN PROCESSING PIPELINE

  function processContext(context, mode = "compact") {
    if (!context || typeof context !== "object") {
      return null;
    }
    if (!Array.isArray(context.messages)) {
      return null;
    }
    const cleanedMessages = formatMessages(context.messages);
    if (cleanedMessages.length === 0) {
      return null;
    }
    const safeMode = mode === "full" ? "full" : "compact";
    const processedMessages =
      safeMode === "compact"? compactTranscript(cleanedMessages): cleanedMessages;
    const text = buildContextPrompt(
      cleanedMessages,
      safeMode,
    );
    if (!text) {
      return null;
    }

    const stateFile = createStateFile(
      cleanedMessages,
      safeMode,
    );

    return {
      platform: context.platform || "unknown",
      title: context.title || "Untitled Conversation",
      url: context.url || window.location.href,
      mode: safeMode,
      messages: cleanedMessages,
      processedMessages,
      text,
      stateFile,
      statistics: {
        originalTurns: cleanedMessages.length,
        processedTurns: processedMessages.length,
        compressionRatio: getCompressionRatio(
          cleanedMessages,
          processedMessages,
        ),
        originalCharacters: calculateTextSize(
          cleanedMessages,
        ),
        processedCharacters: calculateTextSize(
          processedMessages,
        ),
        compressed: shouldCompress(cleanedMessages),
      },
    };
  }
 // 13. PUBLIC API
  window.RelayContextEngine = {
    normalizeWhitespace,
    cleanMessageText,
    formatMessages,
    formatFullContext,
    extractCodeBlocks,
    extractTechnicalDecisions,
    compactTranscript,
    getCompressionRatio,
    summarizeWithLocalAI,
    shouldCompress,
    createStateFile,
    buildContextPrompt,
    processContext,
  };
// Let other content scripts know that the engine is ready.
  window.dispatchEvent(
    new CustomEvent("relayContextEngine-ready", {
      detail: window.RelayContextEngine,
    }),
  );
})();
