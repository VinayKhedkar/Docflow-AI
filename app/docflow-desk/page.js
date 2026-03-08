"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import ChatSection from "../../components/ChatSection";
import DocxRenderer from "../../components/DocxRenderer";
import { useVoiceAgent } from "../../components/VoiceAgent";
import { sentinelScan } from "../../lib/agents";
import { loadDocFromLocal, saveDocToLocal } from "../../lib/docxProcessor";

export default function Home() {
  const [docHtml, setDocHtml] = useState("");
  const [mode, setMode] = useState("general");
  const [input, setInput] = useState("");
  const [overlayPhase, setOverlayPhase] = useState(null); // null | 'in' | 'out'

  const docHtmlRef = useRef(docHtml);
  const modeRef = useRef(mode);
  const addToolResultRef = useRef(null);
  const shouldScanRef = useRef(false);

  // ─── Per-mode chat history stores ─────────────────────────────
  const generalMessagesRef = useRef([]);
  const legalMessagesRef = useRef([]);
  const messagesRef = useRef([]);
  const setMessagesRef = useRef(null);

  // Keep refs in sync
  useEffect(() => { docHtmlRef.current = docHtml; }, [docHtml]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ─── Load doc from localStorage on mount ──────────────────────
  useEffect(() => {
    const saved = loadDocFromLocal();
    if (saved) setDocHtml(saved);
  }, []);

  // ─── Auto-save document to localStorage every 2 seconds ───────
  useEffect(() => {
    const interval = setInterval(() => {
      if (docHtmlRef.current) {
        saveDocToLocal(docHtmlRef.current);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ─── Toggle .legal-mode class on <html> for theme switching ───
  useEffect(() => {
    document.documentElement.classList.toggle("legal-mode", mode === "legal");
  }, [mode]);

  // ─── Animated mode switch (blur overlay slides up → mode flips → slides down) ─
  // Also swaps chat histories: saves current messages, restores the other mode's.
  const handleModeChange = useCallback((newMode) => {
    if (overlayPhase) return; // already transitioning
    // Phase 1: blur overlay slides in from bottom
    setOverlayPhase("in");
    setTimeout(() => {
      // Save current mode's messages before switching
      const currentMessages = messagesRef.current;
      if (modeRef.current === "general") {
        generalMessagesRef.current = currentMessages;
      } else {
        legalMessagesRef.current = currentMessages;
      }

      // Restore the target mode's messages (blank if never used)
      const restored = newMode === "general"
        ? generalMessagesRef.current
        : legalMessagesRef.current;
      setMessagesRef.current(restored);

      // Phase 2: switch the mode while screen is blurred
      setMode(newMode);
      // Phase 3: after a brief pause, slide overlay back down
      setTimeout(() => {
        setOverlayPhase("out");
        // Phase 4: clean up after animation ends
        setTimeout(() => setOverlayPhase(null), 1200);
      }, 1500);
    }, 420);
  }, [overlayPhase]);

  // ─── Transport config (SDK 6.0: body via function for dynamic mode) ─
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({ mode: modeRef.current, currentDocument: docHtmlRef.current || "" }),
  }), []);

  // ─── useChat hook (AI SDK 6.0) ─────────────────────────────────
  const {
    messages,
    sendMessage,
    status,
    setMessages,
    addToolResult,
  } = useChat({
    transport,
    // Auto-resubmit when all tool calls have been resolved (replaces maxSteps)
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall({ toolCall }) {
      console.log("[LexiFlow] Tool call:", toolCall.toolName, toolCall.toolCallId);

      try {
        if (toolCall.toolName === "set_document") {
          const { html, title } = toolCall.input || toolCall.args || {};
          if (html) {
            setDocHtml(html);
            saveDocToLocal(html);
            console.log("[LexiFlow] Document set:", title);
          }
          if (modeRef.current === "legal") {
            shouldScanRef.current = true;
          }
          // Do NOT call addToolResult here — calling it during streaming
          // deadlocks the SDK's internal job executor. set_document is the
          // final tool so no further resubmit is needed.
        }
      } catch (err) {
        console.error("[LexiFlow] onToolCall error:", err);
      }
      // request_missing_info: NOT resolved here — renders as ElicitationCard,
      // which calls handleElicitSubmit when the user submits the form.
    },
  });

  // Keep addToolResult ref in sync (used inside onToolCall callback)
  addToolResultRef.current = addToolResult;

  // Keep messagesRef and setMessagesRef in sync
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { setMessagesRef.current = setMessages; }, [setMessages]);

  const isAgentTyping = status === "streaming" || status === "submitted";

  // ─── Resolve unresolved set_document parts after streaming finishes ──
  // onToolCall can't call addToolResult during streaming (deadlocks the
  // SDK job executor), so we resolve set_document here once status is "ready".
  // This triggers sendAutomaticallyWhen → auto-resubmit → Gemini sends
  // a brief confirmation text → done.
  useEffect(() => {
    if (status !== "ready" || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant") return;

    for (const part of lastMsg.parts || []) {
      const toolName = part.toolName || (part.type?.startsWith("tool-") ? part.type.slice(5) : null);
      if (toolName === "set_document" && part.state === "input-available" && part.toolCallId) {
        console.log("[Page] Resolving set_document after stream finished:", part.toolCallId);
        addToolResult({
          tool: "set_document",
          toolCallId: part.toolCallId,
          output: "Document set successfully.",
        });
        break;
      }
    }
  }, [status, messages, addToolResult]);

  // DEBUG: log messages & status on every render
  useEffect(() => {
    console.log("[Page] status:", status, "messages:", messages.length);
    messages.forEach((m, i) => {
      console.log(`[Page] msg[${i}] role=${m.role} parts=`, m.parts?.map(p => p.type));
    });
  }, [messages, status]);

  // ─── Sentinel scan after document is set (legal mode only) ────
  useEffect(() => {
    if (!shouldScanRef.current || !docHtml) return;
    shouldScanRef.current = false;

    const timer = setTimeout(() => {
      const scan = sentinelScan(docHtml);
      if (scan) {
        const toolCallId = `sentinel-${Date.now()}`;
        const fields = [{
          id: scan.field || "compliance_check",
          label: scan.field?.replace(/_/g, " ") || "Compliance Check",
        }];
        setMessages((prev) => [
          ...prev,
          {
            id: `sent-msg-${Date.now()}`,
            role: "assistant",
            parts: [
              { type: "text", text: scan.message || "" },
              {
                type: "dynamic-tool",
                state: "input-available",
                toolCallId,
                toolName: "request_missing_info",
                input: { fields },
              },
            ],
          },
        ]);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [docHtml, setMessages]);

  // ─── Handle doc changes from editor ───────────────────────────
  const handleDocChange = useCallback((html) => {
    setDocHtml(html);
    saveDocToLocal(html);
  }, []);

  // ─── Submit from chat input ────────────────────────────────────
  const handleSubmit = useCallback((e) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendMessage({ text });
    setInput("");
  }, [input, sendMessage]);

  // ─── Send message (from quick chips or voice) ──────────────────
  const handleSendMessage = useCallback((text) => {
    sendMessage({ text });
  }, [sendMessage]);

  // ─── ElevenLabs Voice Agent ────────────────────────────────────
  const voiceContext = useMemo(() => ({ docHtml, mode }), [docHtml, mode]);
  const { isActive: voiceActive, isSpeaking, status: voiceStatus, toggleVoice } = useVoiceAgent({
    onTranscript: handleSendMessage,
    context: voiceContext,
  });

  // ─── Handle elicitation card submission (multi-field) ─────────
  const handleElicitSubmit = useCallback(async (toolCallId, values) => {
    // Replace placeholders directly in the current document
    const currentDoc = docHtmlRef.current;
    if (currentDoc) {
      let updated = currentDoc;
      let replaced = false;
      for (const [field, value] of Object.entries(values)) {
        const fieldUpper = field.toUpperCase().replace(/_/g, " ");
        const variants = [
          `[${fieldUpper}]`,
          `[${field.toUpperCase()}]`,
          `[${fieldUpper.replace(/ /g, "_")}]`,
        ];
        for (const ph of variants) {
          if (updated.includes(ph)) {
            updated = updated.replaceAll(ph, value);
            replaced = true;
          }
        }
      }
      if (replaced) {
        setDocHtml(updated);
        saveDocToLocal(updated);
      }
    }

    // Resolve the tool call so the agent can continue drafting
    console.log("[Page] handleElicitSubmit called. toolCallId:", toolCallId, "values:", values);
    try {
      await addToolResult({
        tool: "request_missing_info",
        toolCallId,
        output: JSON.stringify(values),
      });
      console.log("[Page] addToolResult succeeded. Status should auto-resubmit now.");
    } catch (err) {
      console.error("[Page] addToolResult error:", err);
    }
  }, [addToolResult]);

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "2fr 3fr",
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
      background: "var(--bg-primary)",
    }}>
      <ChatSection
        messages={messages}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        onSendMessage={handleSendMessage}
        onElicitSubmit={handleElicitSubmit}
        isAgentTyping={isAgentTyping}
        mode={mode}
        onModeChange={handleModeChange}
        voiceActive={voiceActive}
        voiceStatus={voiceStatus}
        isSpeaking={isSpeaking}
        onToggleVoice={toggleVoice}
      />
      <DocxRenderer docHtml={docHtml} onDocChange={handleDocChange} mode={mode} />

      {/* Mode transition overlay */}
      {overlayPhase && (
        <div
          className={`mode-overlay backdrop-blur-sm ${overlayPhase === "in" ? "phase-in" : "phase-out"}`}
        />
      )}
    </div>
  );
}
