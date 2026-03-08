"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  Highlighter,
  Upload,
  Download,
  FileText,
  Undo2,
  Redo2,
  Type,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  MoreHorizontal,
  ZoomIn,
  ZoomOut,
  Printer,
  Copy,
  Strikethrough,
  Shield,
  X,
} from "lucide-react";
import { parseDocx, exportDocx, saveDocToLocal } from "../lib/docxProcessor";

/**
 * DocxRenderer — Modern document editor with floating toolbar & page canvas.
 */
const A4_HEIGHT = 1056; // A4 at 96 DPI

// ─── Indian Legal References Database ────────────────────────────
const LEGAL_REFERENCES = [
  {
    keyword: "confidential",
    section: "Section 27",
    act: "Indian Contract Act, 1872",
    note: "Restraint of trade / confidentiality",
  },
  {
    keyword: "nda",
    section: "Section 27",
    act: "Indian Contract Act, 1872",
    note: "Non-disclosure agreements",
  },
  {
    keyword: "non-disclosure",
    section: "Section 27",
    act: "Indian Contract Act, 1872",
    note: "Restraint of trade",
  },
  {
    keyword: "consideration",
    section: "Section 2(d)",
    act: "Indian Contract Act, 1872",
    note: "Lawful consideration",
  },
  {
    keyword: "agreement",
    section: "Section 10",
    act: "Indian Contract Act, 1872",
    note: "Valid agreements",
  },
  {
    keyword: "breach",
    section: "Section 73",
    act: "Indian Contract Act, 1872",
    note: "Compensation for breach",
  },
  {
    keyword: "criminal breach of trust",
    section: "Section 316",
    act: "BNS (Bharatiya Nyaya Sanhita), 2023",
    note: "Criminal breach of trust (replaces IPC 405)",
  },
  {
    keyword: "fraud",
    section: "Section 318",
    act: "BNS (Bharatiya Nyaya Sanhita), 2023",
    note: "Cheating and dishonestly inducing delivery",
  },
  {
    keyword: "arbitration",
    section: "Section 7",
    act: "Arbitration & Conciliation Act, 1996",
    note: "Arbitration agreement",
  },
  {
    keyword: "jurisdiction",
    section: "Section 9",
    act: "Code of Civil Procedure, 1908",
    note: "Courts of jurisdiction",
  },
  {
    keyword: "termination",
    section: "Section 62",
    act: "Indian Contract Act, 1872",
    note: "Effect of novation / termination",
  },
  {
    keyword: "employment",
    section: "Section 2(s)",
    act: "Industrial Disputes Act, 1947",
    note: "Definition of workman",
  },
  {
    keyword: "compensation",
    section: "Section 4",
    act: "Payment of Wages Act, 1936",
    note: "Wage fixation",
  },
  {
    keyword: "tds",
    section: "Section 192",
    act: "Income Tax Act, 1961",
    note: "TDS on salary",
  },
  {
    keyword: "gst",
    section: "Section 9",
    act: "CGST Act, 2017",
    note: "Levy and collection",
  },
  {
    keyword: "gstin",
    section: "Section 25",
    act: "CGST Act, 2017",
    note: "Registration",
  },
  {
    keyword: "digital india act",
    section: "Part II",
    act: "Digital India Act, 2026",
    note: "Digital governance",
  },
  {
    keyword: "personal data",
    section: "Section 4",
    act: "DPDP Act, 2023",
    note: "Consent for personal data processing",
  },
  {
    keyword: "data protection",
    section: "Section 4",
    act: "DPDP Act, 2023",
    note: "Personal data processing & consent",
  },
  {
    keyword: "data principal",
    section: "Section 8",
    act: "DPDP Act, 2023",
    note: "Rights of Data Principal",
  },
  {
    keyword: "data fiduciary",
    section: "Section 6",
    act: "DPDP Act, 2023",
    note: "Obligations of Data Fiduciary",
  },
  {
    keyword: "consent",
    section: "Section 4",
    act: "DPDP Act, 2023",
    note: "Consent requirements for data processing",
  },
  {
    keyword: "intellectual property",
    section: "Section 14",
    act: "Copyright Act, 1957",
    note: "Rights of copyright owner",
  },
  {
    keyword: "indemnity",
    section: "Section 124",
    act: "Indian Contract Act, 1872",
    note: "Contract of indemnity",
  },
  {
    keyword: "guarantee",
    section: "Section 126",
    act: "Indian Contract Act, 1872",
    note: "Contract of guarantee",
  },
  {
    keyword: "stamp",
    section: "Section 3",
    act: "Indian Stamp Act, 1899",
    note: "Instruments chargeable",
  },
  {
    keyword: "governing law",
    section: "Section 28",
    act: "Indian Contract Act, 1872",
    note: "Agreements in restraint of legal proceedings",
  },
  {
    keyword: "notice period",
    section: "Section 25F",
    act: "Industrial Disputes Act, 1947",
    note: "Conditions for retrenchment",
  },
];

function detectLegalReferences(htmlContent) {
  if (!htmlContent) return [];
  const text = htmlContent.toLowerCase();
  const found = [];
  const seenSections = new Set();
  for (const ref of LEGAL_REFERENCES) {
    const key = `${ref.section}-${ref.act}`;
    if (text.includes(ref.keyword) && !seenSections.has(key)) {
      seenSections.add(key);
      found.push(ref);
    }
  }
  return found;
}

export default function DocxRenderer({
  docHtml,
  onDocChange,
  mode = "general",
}) {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [zoom, setZoom] = useState(100);
  const [numPages, setNumPages] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("Untitled Document");
  const [isRenaming, setIsRenaming] = useState(false);
  const renameInputRef = useRef(null);
  const isLocalEdit = useRef(false);

  // Track content height → calculate pages
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setNumPages(Math.max(1, Math.ceil(el.scrollHeight / A4_HEIGHT)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sync external docHtml changes (from agent) into the canvas
  useEffect(() => {
    if (isLocalEdit.current) {
      // Skip — this was triggered by user typing
      isLocalEdit.current = false;
      return;
    }
    if (canvasRef.current && docHtml !== undefined) {
      canvasRef.current.innerHTML = docHtml || "";
    }
  }, [docHtml]);

  // ─── Formatting Commands ─────────────────────────────
  const execCmd = useCallback(
    (command, value = null) => {
      document.execCommand(command, false, value);
      if (canvasRef.current) {
        const html = canvasRef.current.innerHTML;
        onDocChange(html);
        saveDocToLocal(html);
      }
    },
    [onDocChange],
  );

  const handleHighlight = () => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      execCmd("hiliteColor", "#fde68a");
    }
  };

  // ─── Upload .docx ────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const html = await parseDocx(file);
      onDocChange(html);
      saveDocToLocal(html);
      if (canvasRef.current) {
        canvasRef.current.innerHTML = html;
      }
    } catch (err) {
      console.error("Error parsing docx:", err);
    }
  };

  // ─── Export .docx ────────────────────────────────────
  const handleExport = async () => {
    const html = canvasRef.current?.innerHTML || docHtml;
    await exportDocx(html);
  };

  // ─── Content change (user typing) ─────────────────────
  const handleInput = () => {
    if (canvasRef.current) {
      isLocalEdit.current = true;
      const html = canvasRef.current.innerHTML;
      onDocChange(html);
      saveDocToLocal(html);
    }
  };

  // ─── Toolbar groups ─────────────────────────────────
  const ToolbarGroup = ({ children }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "2px",
        padding: "2px 4px",
        borderRadius: "8px",
        background: "var(--bg-input)",
      }}
    >
      {children}
    </div>
  );

  const ToolBtn = ({ icon, label, onClick, active = false }) => (
    <button
      title={label}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: "6px",
        border: "none",
        background: active ? "var(--accent-glow)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-secondary)",
        cursor: "pointer",
        transition: "all 0.12s ease",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "rgba(0,0,0,0.04)";
          e.currentTarget.style.color = "var(--text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--text-secondary)";
        }
      }}
    >
      {icon}
    </button>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: "#f0ede8",
      }}
    >
      {/* ── Top bar — file name + actions ───────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#ffffff",
          borderBottom: "1px solid var(--border-color)",
          flexShrink: 0,
          height: 64,
        }}
      >
        {/* Left — Doc icon + title */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "8px",
              background: "var(--accent-glow)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FileText size={16} color="var(--accent)" />
          </div>
          <div>
            {isRenaming ? (
              <input
                ref={renameInputRef}
                autoFocus
                defaultValue={docTitle}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v) setDocTitle(v);
                  setIsRenaming(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = e.target.value.trim();
                    if (v) setDocTitle(v);
                    setIsRenaming(false);
                  }
                  if (e.key === "Escape") setIsRenaming(false);
                }}
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.01em",
                  border: "1px solid var(--border-active)",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  outline: "none",
                  background: "var(--bg-input)",
                  width: 180,
                }}
              />
            ) : (
              <div
                onClick={() => setIsRenaming(true)}
                title="Click to rename"
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.01em",
                  cursor: "pointer",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-input)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {docTitle}
              </div>
            )}
          </div>
        </div>

        {/* Right — file actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            style={{ display: "none" }}
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              background: "#fff",
              color: "var(--text-secondary)",
              fontSize: "1rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--text-muted)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-color)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <Upload size={13} /> Import
          </button>
          <button
            onClick={handleExport}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 16px",
              borderRadius: "8px",
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            <Download size={13} /> Export .docx
          </button>
        </div>
      </div>

      {/* ── Toolbar — floating grouped buttons ──────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 20px",
          background: "#ffffff",
          borderBottom: "1px solid var(--border-color)",
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        {/* History */}
        <ToolbarGroup>
          <ToolBtn
            icon={<Undo2 size={14} />}
            label="Undo"
            onClick={() => execCmd("undo")}
          />
          <ToolBtn
            icon={<Redo2 size={14} />}
            label="Redo"
            onClick={() => execCmd("redo")}
          />
        </ToolbarGroup>

        {/* Text style */}
        <ToolbarGroup>
          <ToolBtn
            icon={<Bold size={14} />}
            label="Bold (Ctrl+B)"
            onClick={() => execCmd("bold")}
          />
          <ToolBtn
            icon={<Italic size={14} />}
            label="Italic (Ctrl+I)"
            onClick={() => execCmd("italic")}
          />
          <ToolBtn
            icon={<Underline size={14} />}
            label="Underline (Ctrl+U)"
            onClick={() => execCmd("underline")}
          />
          <ToolBtn
            icon={<Strikethrough size={14} />}
            label="Strikethrough"
            onClick={() => execCmd("strikeThrough")}
          />
        </ToolbarGroup>

        {/* Heading */}
        <ToolbarGroup>
          <ToolBtn
            icon={<Heading1 size={14} />}
            label="Heading 1"
            onClick={() => execCmd("formatBlock", "h1")}
          />
          <ToolBtn
            icon={<Heading2 size={14} />}
            label="Heading 2"
            onClick={() => execCmd("formatBlock", "h2")}
          />
          <ToolBtn
            icon={<Type size={14} />}
            label="Normal text"
            onClick={() => execCmd("formatBlock", "p")}
          />
        </ToolbarGroup>

        {/* Color and highlight */}
        <ToolbarGroup>
          <ToolBtn
            icon={<Highlighter size={14} />}
            label="Highlight"
            onClick={handleHighlight}
          />
        </ToolbarGroup>

        {/* List */}
        <ToolbarGroup>
          <ToolBtn
            icon={<List size={14} />}
            label="Bullet list"
            onClick={() => execCmd("insertUnorderedList")}
          />
          <ToolBtn
            icon={<ListOrdered size={14} />}
            label="Numbered list"
            onClick={() => execCmd("insertOrderedList")}
          />
        </ToolbarGroup>

        {/* Align */}
        <ToolbarGroup>
          <ToolBtn
            icon={<AlignLeft size={14} />}
            label="Align left"
            onClick={() => execCmd("justifyLeft")}
          />
          <ToolBtn
            icon={<AlignCenter size={14} />}
            label="Align center"
            onClick={() => execCmd("justifyCenter")}
          />
          <ToolBtn
            icon={<AlignRight size={14} />}
            label="Align right"
            onClick={() => execCmd("justifyRight")}
          />
        </ToolbarGroup>

        {/* Horizontal rule */}
        <ToolbarGroup>
          <ToolBtn
            icon={<Minus size={14} />}
            label="Horizontal line"
            onClick={() => execCmd("insertHorizontalRule")}
          />
        </ToolbarGroup>

        <div style={{ flex: 1 }} />

        {/* Zoom controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "0.72rem",
            color: "var(--text-muted)",
          }}
        >
          <button
            onClick={() => setZoom((z) => Math.max(60, z - 10))}
            style={{
              width: 26,
              height: 26,
              borderRadius: "6px",
              border: "none",
              background: "var(--bg-input)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ZoomOut size={12} />
          </button>
          <span style={{ minWidth: 36, textAlign: "center", fontWeight: 500 }}>
            {zoom}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(150, z + 10))}
            style={{
              width: 26,
              height: 26,
              borderRadius: "6px",
              border: "none",
              background: "var(--bg-input)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ZoomIn size={12} />
          </button>
        </div>
      </div>

      {/* ── Page canvas area ────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          position: "relative",
        }}
      >
        {/* Main document area */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "32px 40px 64px",
          }}
        >
          {docHtml ? (
            <div
              style={{
                width: "100%",
                maxWidth: 816,
                minHeight: numPages * A4_HEIGHT,
                margin: "0 auto",
                background: "#ffffff",
                borderRadius: "2px",
                boxShadow:
                  "0 1px 4px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)",
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
                transition: "transform 0.15s ease",
                position: "relative",
              }}
            >
              <div
                ref={canvasRef}
                className="doc-canvas"
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                style={{ position: "relative", zIndex: 1 }}
              />
            </div>
          ) : (
            /* ── Empty state ─────────────────────────── */
            <div
              style={{
                width: "100%",
                maxWidth: 816,
                minHeight: A4_HEIGHT,
                margin: "0 auto",
                background: "#ffffff",
                borderRadius: "2px",
                boxShadow:
                  "0 1px 4px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "20px",
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "16px",
                  background: "var(--bg-input)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FileText
                  size={32}
                  color="var(--text-muted)"
                  strokeWidth={1.2}
                />
              </div>
              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: "6px",
                  }}
                >
                  No document yet
                </p>
                <p className="font-semibold"
                  style={{
                    fontSize: "1rem",
                    color: "var(--text-muted)",
                    lineHeight: 1.5,
                    maxWidth: 300,
                  }}
                >
                  Use the chat to draft a new document or click{" "}
                  <strong>Import</strong> to upload an existing{" "}
                  <strong>.docx</strong> file.
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 20px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  background: "#ffffff",
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.color = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                <Upload size={14} /> Upload .docx
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                style={{ display: "none" }}
                onChange={handleUpload}
              />
            </div>
          )}
        </div>

        {/* ── Legal Compliance Drawer ──────────────────── */}
        {mode === "legal" &&
          docHtml &&
          (() => {
            const refs = detectLegalReferences(docHtml);
            return (
              <>
                {/* Floating trigger button — bottom-right */}
                <button
                  onClick={() => setDrawerOpen((o) => !o)}
                  title="Compliance Panel"
                  style={{
                    position: "absolute",
                    bottom: 24,
                    right: 24,
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    border: "2px solid #c9a84c",
                    background: drawerOpen ? "rgba(30,42,74,0.95)" : "#1e2a4a",
                    color: "#d4a843",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 12,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                    transition: "transform 0.2s, box-shadow 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.1)";
                    e.currentTarget.style.boxShadow =
                      "0 6px 24px rgba(0,0,0,0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 16px rgba(0,0,0,0.3)";
                  }}
                >
                  {drawerOpen ? (
                    <X size={20} />
                  ) : (
                    <>
                      <Shield size={20} fill="#d4a843" />
                      {refs.length > 0 && (
                        <span
                          style={{
                            position: "absolute",
                            top: -4,
                            right: -4,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#d4a843",
                            color: "#1e2a4a",
                            fontSize: "0.65rem",
                            fontWeight: 800,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {refs.length}
                        </span>
                      )}
                    </>
                  )}
                </button>

                {/* Drawer panel */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 80,
                    right: 24,
                    width: 300,
                    maxHeight: drawerOpen ? 460 : 0,
                    opacity: drawerOpen ? 1 : 0,
                    background: "#1e2a4a",
                    border: drawerOpen
                      ? "2px solid #c9a84c"
                      : "2px solid transparent",
                    borderRadius: "14px",
                    overflow: "hidden",
                    zIndex: 11,
                    boxShadow: drawerOpen
                      ? "0 8px 32px rgba(0,0,0,0.4)"
                      : "none",
                    transition:
                      "max-height 0.3s ease, opacity 0.2s ease, border-color 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    pointerEvents: drawerOpen ? "auto" : "none",
                  }}
                >
                  {/* Drawer header */}
                  <div
                    style={{
                      padding: "14px 16px",
                      borderBottom: "1px solid rgba(201,168,76,0.2)",
                      background: "#1e2a4a",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "4px",
                      }}
                    >
                      <Shield size={14} color="#d4a843" fill="#d4a843" />
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#d4a843",
                        }}
                      >
                        Compliance Panel
                      </span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "#d4a843",
                          background: "rgba(212,168,67,0.15)",
                          padding: "2px 10px",
                          borderRadius: "10px",
                        }}
                      >
                        {refs.length}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: "0.68rem",
                        color: "rgba(255,255,255,0.45)",
                        margin: 0,
                        lineHeight: 1.4,
                      }}
                    >
                      Live references detected from your document
                    </p>
                  </div>

                  {/* Reference list — scrollable */}
                  <div
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      padding: "4px 0",
                    }}
                  >
                    {refs.length === 0 ? (
                      <p
                        style={{
                          fontSize: "0.72rem",
                          color: "rgba(255,255,255,0.3)",
                          textAlign: "center",
                          padding: "24px 16px",
                          margin: 0,
                        }}
                      >
                        No legal references detected yet. Start drafting to see
                        live references.
                      </p>
                    ) : (
                      refs.map((ref, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "10px 16px",
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                            transition: "background 0.15s",
                            cursor: "default",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background =
                              "rgba(212,168,67,0.06)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              marginBottom: "3px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                color: "#d4a843",
                              }}
                            >
                              {ref.section}
                            </span>
                            <span
                              style={{
                                width: 3,
                                height: 3,
                                borderRadius: "50%",
                                background: "rgba(255,255,255,0.2)",
                                display: "inline-block",
                              }}
                            />
                            <span
                              style={{
                                fontSize: "0.65rem",
                                color: "rgba(255,255,255,0.5)",
                                fontStyle: "italic",
                              }}
                            >
                              {ref.act}
                            </span>
                          </div>
                          <p
                            style={{
                              fontSize: "0.68rem",
                              color: "rgba(255,255,255,0.65)",
                              margin: 0,
                              lineHeight: 1.3,
                            }}
                          >
                            {ref.note}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  <div
                    style={{
                      padding: "10px 16px",
                      borderTop: "1px solid rgba(201,168,76,0.15)",
                      background: "#1e2a4a",
                      flexShrink: 0,
                    }}
                  >
                    <p
                      style={{
                        fontSize: "0.62rem",
                        color: "rgba(255,255,255,0.3)",
                        margin: 0,
                        textAlign: "center",
                        lineHeight: 1.4,
                      }}
                    >
                      References are auto-detected. Verify with qualified legal
                      counsel.
                    </p>
                  </div>
                </div>
              </>
            );
          })()}
      </div>
    </div>
  );
}
