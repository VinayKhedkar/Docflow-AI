"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Bot,
  User,
  Shield,
  FileText,
  AudioLines,
} from "lucide-react";
import ElicitationCard from "./ElicitationCard";

// ─── Agent Pipeline Animation ────────────────────────────────────
const AGENT_CONFIGS = {
  legal: [
    { id: "pm", label: "PM Agent", sublabel: "Routing", icon: "🧭", delay: 0 },
    {
      id: "legal",
      label: "Legal Agent",
      sublabel: "Drafting",
      icon: "⚖️",
      delay: 800,
    },
    {
      id: "sentinel",
      label: "Sentinel",
      sublabel: "Compliance",
      icon: "🛡️",
      delay: 1600,
    },
  ],
  general: [
    { id: "pm", label: "PM Agent", sublabel: "Routing", icon: "🧭", delay: 0 },
    {
      id: "general",
      label: "Writing Agent",
      sublabel: "Drafting",
      icon: "✍️",
      delay: 800,
    },
  ],
};

function AgentPipeline({ mode }) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const agents = AGENT_CONFIGS[mode] || AGENT_CONFIGS.general;

  useEffect(() => {
    let cancelled = false;
    const totalCycle = agents[agents.length - 1].delay + 2000;

    function runCycle() {
      agents.forEach((agent, i) => {
        setTimeout(() => {
          if (!cancelled) setActiveIndex(i);
        }, agent.delay + 300);
      });
    }

    runCycle();
    const interval = setInterval(runCycle, totalCycle);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [agents]);

  return (
    <div
      className="agent-pipeline-wrapper"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "0px",
        padding: "7px 10px",
        borderRadius: "12px 12px 12px 4px",
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {agents.map((agent, i) => {
        const isActive = i === activeIndex;
        const isPast = i < activeIndex;
        return (
          <div
            key={agent.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* Connector dots between agents (vertical) */}
            {i > 0 && (
              <div
                className="agent-connector"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "1px",
                  margin: "2px 0",
                  animationDelay: `${agent.delay + 500}ms`,
                }}
              >
                {[0, 1, 2].map((d) => (
                  <div
                    key={d}
                    className={isPast || isActive ? "agent-connector-dot" : ""}
                    style={{
                      width: 2,
                      height: 2,
                      borderRadius: "50%",
                      background:
                        isPast || isActive
                          ? "var(--accent)"
                          : "var(--text-muted)",
                      opacity: isPast || isActive ? 1 : 0.3,
                      animationDelay: `${d * 0.15}s`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Agent node */}
            <div
              className={`agent-pipeline-node ${isActive ? "active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 8px",
                borderRadius: "8px",
                background: isActive
                  ? "var(--accent-glow)"
                  : isPast
                    ? "var(--accent-light)"
                    : "transparent",
                border: isActive
                  ? "1px solid var(--accent)"
                  : "1px solid transparent",
                animationDelay: `${agent.delay}ms`,
                transition: "background 0.3s, border-color 0.3s",
              }}
            >
              <span style={{ fontSize: "0.72rem", lineHeight: 1 }}>
                {agent.icon}
              </span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{
                    fontSize: "0.62rem",
                    fontWeight: 600,
                    color: isActive
                      ? "var(--accent)"
                      : isPast
                        ? "var(--text-secondary)"
                        : "var(--text-muted)",
                    whiteSpace: "nowrap",
                    transition: "color 0.3s",
                  }}
                >
                  {agent.label}
                </span>
                {isActive && (
                  <span
                    style={{
                      fontSize: "0.54rem",
                      color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {agent.sublabel}…
                  </span>
                )}
              </div>
              {/* Status indicator */}
              <div style={{ marginLeft: "1px" }}>
                {isActive && <div className="agent-spinner" />}
                {isPast && (
                  <svg
                    className="agent-check"
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <circle cx="6" cy="6" r="6" fill="var(--accent)" />
                    <path
                      d="M3.5 6L5.5 8L8.5 4.5"
                      stroke="#fff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Simple markdown → HTML renderer ─────────────────────────────
function renderMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
    .replace(
      /`(.*?)`/g,
      "<code style='background:#f0ede8;padding:1px 5px;border-radius:4px;font-size:0.8em'>$1</code>",
    )
    .replace(
      /^### (.+)$/gm,
      "<strong style='display:block;margin-top:8px'>$1</strong>",
    )
    .replace(
      /^## (.+)$/gm,
      "<strong style='display:block;font-size:1.05em;margin-top:10px'>$1</strong>",
    )
    .replace(
      /^[*-] (.+)$/gm,
      "<li style='margin-left:16px;list-style:disc'>$1</li>",
    )
    .replace(
      /^\d+\.\s(.+)$/gm,
      "<li style='margin-left:16px;list-style:decimal'>$1</li>",
    )
    .replace(/\n/g, "<br/>");
  html = html.replace(
    /((?:<li[^>]*>.*?<\/li>(?:<br\/>)?)+)/g,
    "<ul style='padding-left:4px;margin:4px 0'>$1</ul>",
  );
  html = html.replace(/<br\/><\/ul>/g, "</ul>");
  return html;
}

const LEGAL_CHIPS = [
  "Draft an NDA",
  "Create a service agreement",
  "Draft an employment agreement",
];

const GENERAL_CHIPS = [
  "Summarize this report",
  "Draft a weekly update",
  "Write a professional email",
];

/**
 * ChatSection — Left panel: chat messages, text input, mode toggle, and voice button.
 *
 * Props:
 *   - input          : string
 *   - setInput       : (val: string) => void
 *   - handleSubmit   : (e: React.FormEvent) => void
 *   - onSendMessage  : (text: string) => void
 *   - onElicitSubmit : (toolCallId, field, value) => void
 *   - isAgentTyping  : boolean
 *   - mode           : 'general' | 'legal'
 *   - onModeChange   : (mode: string) => void
 *   - voiceActive    : boolean — whether voice agent is active
 *   - voiceStatus    : string — 'disconnected' | 'connecting' | 'connected'
 *   - isSpeaking     : boolean — whether the voice agent is speaking
 *   - onToggleVoice  : () => void — toggle voice agent on/off
 */
export default function ChatSection({
  messages = [],
  input,
  setInput,
  handleSubmit,
  onSendMessage,
  onElicitSubmit,
  isAgentTyping = false,
  mode = "general",
  onModeChange,
  voiceActive = false,
  voiceStatus = "disconnected",
  isSpeaking = false,
  onToggleVoice,
}) {
  const scrollRef = useRef(null);

  const isLegal = mode === "legal";
  const chips = isLegal ? LEGAL_CHIPS : GENERAL_CHIPS;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAgentTyping]);

  const handleSend = (e) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text) return;
    handleSubmit(e);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: "var(--bg-primary)",
        borderRight: "1px solid var(--border-color)",
      }}
    >
      {/* ── Header ────────────────────────────────────────── */}
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--ribbon-bg)",
          flexShrink: 0,
          height: 64,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/logo.png" alt="DocFlow AI" width={35} height={35} />
          <div
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            DocFlow AI
          </div>
        </div>

        {/* ── Mode Toggle ──────────────────────────────── */}
        <button
          onClick={() => onModeChange(isLegal ? "general" : "legal")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 14px",
            borderRadius: "20px",
            border: isLegal
              ? "1.5px solid #c9a84c"
              : "1.5px solid var(--border-color)",
            background: isLegal ? "rgba(212,168,67,0.08)" : "var(--bg-card)",
            cursor: "pointer",
            transition: "all 0.25s ease",
          }}
        >
          <Shield
            size={13}
            color={isLegal ? "#c9a84c" : "var(--text-muted)"}
            fill={isLegal ? "#c9a84c" : "none"}
          />
          <span
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: isLegal ? "#1e2a4a" : "var(--text-muted)",
              letterSpacing: "0.02em",
            }}
          >
            Legal Mode
          </span>
          {/* Toggle track */}
          <div
            style={{
              width: 32,
              height: 18,
              borderRadius: 9,
              background: isLegal ? "#1e2a4a" : "#d4d4d4",
              position: "relative",
              transition: "background 0.25s ease",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: isLegal ? "#d4a843" : "#fff",
                position: "absolute",
                top: 2,
                left: isLegal ? 16 : 2,
                transition: "left 0.25s ease",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
              }}
            />
          </div>
        </button>
      </div>

      {/* ── Messages ──────────────────────────────────────── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* Welcome message */}
        {messages.length === 0 && !isAgentTyping && (
          <div
            className="animate-fade-in-up"
            style={{ textAlign: "center", padding: "40px 20px" }}
          >
            <h1
              style={{
                fontSize: "1.3rem",
                fontWeight: 700,
                marginBottom: "8px",
                color: "var(--text-primary)",
              }}
            >
              {isLegal ? "Welcome to DocFlow AI" : "Welcome to DocFlow AI"}
            </h1>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                maxWidth: 300,
                margin: "0 auto",
              }}
            >
              {isLegal ? (
                <span className="text-[1.1rem]">
                  Your India-specific legal AI assistant. Try saying{" "}
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                    &quot;Draft an NDA&quot;
                  </span>{" "}
                  or{" "}
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                    &quot;Create a service agreement&quot;
                  </span>
                  .
                </span>
              ) : (
                <span className="text-[1rem] font-semibold">
                  Your AI writing assistant. Try saying{" "}
                  <span style={{ fontWeight: 600 }}>
                    &quot;Draft a weekly update&quot;
                  </span>{" "}
                  or{" "}
                  <span style={{ fontWeight: 600 }}>
                    &quot;Write an email&quot;
                  </span>
                  . Toggle <strong>Legal Mode</strong> for contracts.
                </span>
              )}
            </p>

            {/* Quick-start chips */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "8px",
                marginTop: "20px",
              }}
            >
              {chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => onSendMessage(chip)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "20px",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-secondary)",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.borderColor = isLegal
                      ? "var(--accent)"
                      : "var(--text-primary)";
                    e.target.style.color = isLegal
                      ? "var(--accent)"
                      : "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.borderColor = "var(--border-color)";
                    e.target.style.color = "var(--text-secondary)";
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className="animate-fade-in-up"
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              gap: "8px",
              alignItems: "flex-end",
              width: "100%", // Ensure full width for cards
            }}
          >
            {/* Agent avatar */}
            {msg.role !== "user" && (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "8px",
                  background: "var(--accent-glow)",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Bot size={14} color="var(--accent)" />
              </div>
            )}

            {/* Message Container */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxWidth: "80%",
              }}
            >
              {msg.parts?.map((part, index) => {
                // DEBUG: log every part to console so we can trace what SDK sends
                console.log(
                  `[ChatSection] msg=${msg.id} role=${msg.role} part[${index}]:`,
                  part.type,
                  part,
                );

                // 1. Render Text Parts
                if (part.type === "text" && part.text.trim()) {
                  return (
                    <div
                      key={index}
                      style={{
                        padding: "10px 14px",
                        borderRadius:
                          msg.role === "user"
                            ? "14px 14px 4px 14px"
                            : "14px 14px 14px 4px",
                        background:
                          msg.role === "user"
                            ? "var(--user-bubble)"
                            : "var(--bg-card)",
                        border:
                          msg.role === "user"
                            ? "none"
                            : "1px solid var(--border-color)",
                        color:
                          msg.role === "user" ? "#fff" : "var(--text-primary)",
                        fontSize: "0.84rem",
                        lineHeight: 1.55,
                      }}
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(part.text),
                      }}
                    />
                  );
                }

                // 2. Render Tool Invocation (Elicitation Card)
                if (
                  part.type === "tool-invocation" ||
                  part.type === "dynamic-tool" ||
                  part.type?.startsWith("tool-")
                ) {
                  // SDK 6 uses type "tool-<toolName>", with toolCallId, input, output, state
                  // state values: "input-streaming", "input-available", "output-available"
                  const toolName =
                    part.toolName ||
                    (part.type?.startsWith("tool-")
                      ? part.type.slice(5)
                      : part.type);
                  const toolCallId = part.toolCallId;
                  const state = part.state;
                  const args = part.input || part.args || {};
                  const isResolved =
                    state === "output-available" ||
                    state === "result" ||
                    !!part.output ||
                    !!part.result;

                  if (toolName === "request_missing_info") {
                    const parsedValues = (() => {
                      if (!isResolved) return {};
                      const raw = part.output || part.result;
                      if (!raw) return {};
                      try {
                        return JSON.parse(raw);
                      } catch {
                        return {};
                      }
                    })();

                    return (
                      <ElicitationCard
                        key={toolCallId}
                        fields={args?.fields || []}
                        submitted={isResolved}
                        values={parsedValues}
                        onSubmit={(values) =>
                          onElicitSubmit(toolCallId, values)
                        }
                      />
                    );
                  }
                }
                return null;
              })}
            </div>

            {/* User avatar */}
            {msg.role === "user" && (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "8px",
                  background: "var(--user-bubble)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <User size={14} color="#fff" />
              </div>
            )}
          </div>
        ))}

        {/* Agent pipeline — inline below the last assistant message */}
        {isAgentTyping && (
          <div
            className="animate-fade-in-up"
            style={{
              display: "flex",
              justifyContent: "flex-start",
              gap: "8px",
              alignItems: "flex-start",
              width: "100%",
            }}
          >
            {/* Bot avatar */}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "8px",
                background: "var(--accent-glow)",
                border: "1px solid var(--border-color)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <Bot size={14} color="var(--accent)" />
            </div>
            <AgentPipeline mode={mode} />
          </div>
        )}
      </div>

      {/* ── Input Area ────────────────────────────────────── */}
      <div
        style={{
          padding: "14px 16px",
          borderTop: "1px solid var(--border-color)",
          background: "var(--ribbon-bg)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexShrink: 0,
          minHeight: 84,
        }}
      >
        {/* Voice / Call Button */}
        <button
          onClick={onToggleVoice}
          className={voiceActive ? "animate-pulse-ring" : ""}
          disabled={voiceStatus === "connecting"}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "none",
            background: voiceActive
              ? "linear-gradient(135deg, #ef4444, #dc2626)"
              : voiceStatus === "connecting"
                ? "var(--text-secondary)"
                : "var(--user-bubble)",
            color: "#fff",
            cursor: voiceStatus === "connecting" ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            flexShrink: 0,
            opacity: voiceStatus === "connecting" ? 0.7 : 1,
          }}
          title={
            voiceStatus === "connecting"
              ? "Connecting..."
              : voiceActive
                ? "End Voice Session"
                : "Start Voice Commands"
          }
        >
          {voiceActive ? <PhoneOff size={18} /> : <AudioLines size={18} />}
        </button>

        {/* Text Input */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            background: "var(--bg-input)",
            borderRadius: "12px",
            border: "1px solid var(--border-color)",
            padding: "0 4px 0 14px",
            transition: "border-color 0.2s",
            height: "100%",
          }}
        >
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isLegal ? "Ask about legal documents..." : "Type your message..."
            }
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "1rem",
              padding: "10px 0",
              resize: "none",
              lineHeight: 1.4,
              fontFamily: "var(--font-sans)",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input?.trim()}
            style={{
              width: 34,
              height: 34,
              borderRadius: "8px",
              border: "none",
              color: input?.trim() ? "#fff" : "var(--text-muted)",
              cursor: input?.trim() ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
              flexShrink: 0,
            }}
          >
            <Send color={input?.trim() ? "#000" : "var(--text-muted)"} size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
