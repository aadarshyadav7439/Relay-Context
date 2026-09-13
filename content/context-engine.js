// RelayContext Smart Context Engine
// Full transcript,smart compaction, local AI summary, and context prompt generation
function normalizeWhitespace(text) {
  if (!text) {
    return "";
  }

  return text
    .replace(/[ \t]+/g, " ")//multiple balnk spaces => Single space
    .replace(/\n\s*\n+/g, "\n\n")//multiple blank lines => one blank line
    .trim();//satart end ke white space
}

function cleanMessageText(text) {
  return normalizeWhitespace(text);
}

// Raw scraped messages → clean standardized messages karega
function formatMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      text: cleanMessageText(message.text),
    }))
    .filter((message) => message.text);//empty message hatne ke liye
}

//label add hoga for better conv0. understanding
function formatFullContext(messages) {
  const cleanedMessages = formatMessages(messages);

  return cleanedMessages
    .map((message) => {
      const label = message.role === "user" ? "User" : "Assistant";

      return `${label}: ${message.text}`;
    })
    .join("\n---\n");
}

function compactTranscript(messages) {
  const cleanedMessages = formatMessages(messages);

  if (cleanedMessages.length === 0) {
    return [];
  }

  if (cleanedMessages.length <= 10) {
    return cleanedMessages;
  }

  const result = [];

  // Keep the first message because it usually establishes the goal.
  result.push(cleanedMessages[0]);

  // Extract important code blocks and technical decisions.
  const codeBlocks = [];
  const technicalDecisions = [];

  const codeBlockRegex = /```[\s\S]*?```/g;

  for (let i = 1; i < cleanedMessages.length - 1; i++) {
    const message = cleanedMessages[i];

    const matches = message.text.match(codeBlockRegex);

    if (matches) {
      matches.forEach((code) => {
        if (!codeBlocks.includes(code)) {
          codeBlocks.push(code);
        }
      });
    }

    if (
      /decided|implemented|fixed|changed|refactored|optimized|rewrote|switched|moved|added|removed/i.test(
        message.text,
      )
    ) {
      const decision = message.text.split("\n")[0].substring(0, 200);

      if (decision && !technicalDecisions.includes(decision)) {
        technicalDecisions.push(decision);
      }
    }
  }

  // Add important code as technical context.
  if (codeBlocks.length > 0) {
    result.push({
      role: "system",
      text:
        `[Technical Context: Active code snippets]\n\n` +
        codeBlocks.slice(0, 5).join("\n\n"),
    });
  }

  // Add technical decisions.
  if (technicalDecisions.length > 0) {
    result.push({
      role: "system",
      text:
        `[Decision Log]\n` +
        technicalDecisions
          .slice(0, 5)
          .map((decision) => `• ${decision}`)
          .join("\n"),
    });
  }

  // Keep the latest three messages for current conversation context.
  const recentMessages = cleanedMessages.slice(-3);

  recentMessages.forEach((message) => {
    if (!result.includes(message)) {
      result.push(message);
    }
  });

  return result;
}

function getCompressionRatio(original, condensed) {
  if (!Array.isArray(original) || !Array.isArray(condensed)) {
    return "0.0";
  }

  const originalSize = original.reduce(
    (sum, message) => sum + (message.text?.length || 0),
    0,
  );

  const condensedSize = condensed.reduce(
    (sum, message) => sum + (message.text?.length || 0),
    0,
  );

  if (originalSize === 0) {
    return "0.0";
  }

  return ((1 - condensedSize / originalSize) * 100).toFixed(1);
}

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
      systemPrompt + "\n\nCONVERSATION:\n" + rawText,
    );

    session.destroy();

    return {
      mode: "ai",
      content: summary,
      metadata: {
        compressed: true,
        localAI: true,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.warn("RelayContext: Local AI summarization failed", error);

    return null;
  }
}

function shouldCompress(messages) {
  return Array.isArray(messages) && messages.length > 10;
}

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

function buildContextPrompt(messages, mode = "compact", preamble) {
  const cleanedMessages = formatMessages(messages);

  const systemPreamble =
    preamble ||
    `[System Instruction: You are continuing a conversation that began with another AI. The conversation context below contains the previous discussion, goals, decisions, and relevant information. Read it carefully and continue from the current state.]`;

  let transcript = "";

  if (mode === "compact") {
    const compacted = compactTranscript(cleanedMessages);

    compacted.forEach((message) => {
      if (message.role === "system") {
        transcript += `${message.text}\n\n`;
      } else {
        const label = message.role === "user" ? "User" : "Assistant";

        transcript += `${label}: ${message.text}\n---\n`;
      }
    });
  } else {
    cleanedMessages.forEach((message) => {
      const label = message.role === "user" ? "User" : "Assistant";

      transcript += `${label}: ${message.text}\n---\n`;
    });
  }

  return `${systemPreamble}

=== CONVERSATION TRANSCRIPT START ===
${transcript.trim()}
=== CONVERSATION TRANSCRIPT END ===

Continue the conversation based on the context above.`;
}

function processContext(context, mode = "compact") {
  if (!context || !Array.isArray(context.messages)) {
    return null;
  }

  const messages = formatMessages(context.messages);

  if (messages.length === 0) {
    return null;
  }

  const condensed = mode === "compact" ? compactTranscript(messages) : messages;

  return {
    platform: context.platform,
    title: context.title,
    url: context.url,
    mode,
    messages,
    processedMessages: condensed,
    text: buildContextPrompt(messages, mode),
    statistics: {
      originalTurns: messages.length,
      processedTurns: condensed.length,
      compressionRatio: getCompressionRatio(messages, condensed),
    },
  };
}

window.RelayContextEngine = {
  normalizeWhitespace,
  cleanMessageText,
  formatMessages,
  formatFullContext,
  compactTranscript,
  getCompressionRatio,
  summarizeWithLocalAI,
  shouldCompress,
  createStateFile,
  buildContextPrompt,
  processContext,
};

window.dispatchEvent(
  new CustomEvent("relayContextEngine-ready", {
    detail: window.RelayContextEngine,
  }),
);
