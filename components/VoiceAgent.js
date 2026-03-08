"use client";

import { useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useVoiceAgent — Hook that wraps ElevenLabs Conversational AI.
 *
 * Captures the agent's transcript and fires `onTranscript(text)` so
 * the parent can send it as a chat message to modify the document.
 *
 * Accepts `context` (object with docHtml, mode) which is pushed to the
 * ElevenLabs agent via sendContextualUpdate so it understands the app state.
 *
 * Usage:
 *   const { isActive, isSpeaking, status, toggleVoice } = useVoiceAgent({
 *     onTranscript: (text) => sendMessage({ text }),
 *     context: { docHtml, mode },
 *   });
 */
export function useVoiceAgent({ onTranscript, context = {} }) {
  const onTranscriptRef = useRef(onTranscript);
  const contextRef = useRef(context);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { contextRef.current = context; }, [context]);

  const [isActive, setIsActive] = useState(false);
  const conversationRef = useRef(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log("[Voice] Connected — sending app context");
      // Push initial context to the ElevenLabs agent
      sendAppContext();
    },
    onMessage: ({ message, source }) => {
      // "source" is "user" or "ai". We only care about the user transcript —
      // i.e., what the user *said*. The ElevenLabs agent just acknowledges.
      if (source === "user" && message?.trim()) {
        console.log("[Voice] User said:", message);
        onTranscriptRef.current?.(message);
      }
    },
    onError: (error) => {
      console.error("[Voice] Error:", error);
    },
    onDisconnect: () => {
      console.log("[Voice] Disconnected");
      setIsActive(false);
    },
  });

  // Keep a ref so sendAppContext can access it
  conversationRef.current = conversation;

  // Build and send contextual update to the ElevenLabs agent
  const sendAppContext = useCallback(() => {
    const { docHtml, mode } = contextRef.current;
    const hasDoc = !!docHtml?.trim();
    const contextText = [
      `You are a voice assistant for DocFlow AI, an AI document drafting app for Indian SMEs.`,
      `Current mode: ${mode === "legal" ? "Legal Mode (Indian legal documents)" : "General Mode (reports, emails, memos)"}`,
      hasDoc
        ? `The user currently has a document open in the editor. Here is its content:\n---\n${stripHtmlTags(docHtml)}\n---`
        : `The editor is currently empty — no document has been drafted yet.`,
      `When the user asks to draft, modify, or change a document, just acknowledge their request briefly. Their voice command will be sent to the main AI which handles the actual document editing.`,
      `Keep your spoken responses SHORT (1-2 sentences). Do NOT read out entire documents.`,
      `If the user asks about the document content, you can reference it from the context above.`,
    ].join("\n");

    try {
      conversationRef.current?.sendContextualUpdate(contextText);
      console.log("[Voice] Context sent to agent");
    } catch (err) {
      console.warn("[Voice] Failed to send context:", err);
    }
  }, []);

  // Resend context when document or mode changes (while active)
  useEffect(() => {
    if (isActive && conversation.status === "connected") {
      sendAppContext();
    }
  }, [context.docHtml, context.mode, isActive, conversation.status, sendAppContext]);

  const toggleVoice = useCallback(async () => {
    if (isActive) {
      // Stop
      await conversation.endSession();
      setIsActive(false);
    } else {
      // Start — fetch signed URL from our API route
      try {
        const res = await fetch("/api/elevenlabs-signed-url");
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.signedUrl) {
          console.error("[Voice] Failed to get signed URL:", res.status, data);
          return;
        }
        // Request microphone permission and start session
        await navigator.mediaDevices.getUserMedia({ audio: true });
        await conversation.startSession({ signedUrl: data.signedUrl });
        setIsActive(true);
        console.log("[Voice] Session started");
      } catch (err) {
        console.error("[Voice] Start error:", err);
        setIsActive(false);
      }
    }
  }, [isActive, conversation]);

  return {
    isActive,
    isSpeaking: conversation.isSpeaking,
    status: conversation.status, // "disconnected" | "connecting" | "connected"
    toggleVoice,
  };
}

/** Strip HTML tags to get plain text for the voice agent context */
function stripHtmlTags(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|h[1-6]|li|ul|ol|tr)[\s>]/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 3000); // Limit context size
}
