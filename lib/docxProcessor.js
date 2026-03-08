/**
 * docxProcessor.js — Mammoth.js (.docx → HTML) & LocalStorage Sync
 */
import mammoth from "mammoth";
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
} from "docx";
import { saveAs } from "file-saver";

// ─── Storage Keys ──────────────────────────────────────────────────
const DOC_KEY = "lexiflow_doc";
const CHAT_KEY = "lexiflow_chat";

// ─── Parse .docx → HTML ───────────────────────────────────────────
export async function parseDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return result.value; // HTML string
}

// ─── LocalStorage: Document ────────────────────────────────────────
export function saveDocToLocal(html) {
    if (typeof window !== "undefined") {
        localStorage.setItem(DOC_KEY, html);
    }
}

export function loadDocFromLocal() {
    if (typeof window !== "undefined") {
        return localStorage.getItem(DOC_KEY) || "";
    }
    return "";
}

// ─── LocalStorage: Chat ────────────────────────────────────────────
export function saveChatToLocal(messages) {
    if (typeof window !== "undefined") {
        localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
    }
}

export function loadChatFromLocal() {
    if (typeof window !== "undefined") {
        try {
            return JSON.parse(localStorage.getItem(CHAT_KEY)) || [];
        } catch {
            return [];
        }
    }
    return [];
}

// ─── Export HTML → .docx ───────────────────────────────────────────
// Simplified HTML→docx converter: parses headings, paragraphs, and
// inline bold/italic from the contentEditable HTML.
export async function exportDocx(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const children = [];

    const walkNodes = (parentEl) => {
        for (const node of parentEl.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                if (text) {
                    children.push(new Paragraph({ children: [new TextRun(text)] }));
                }
                continue;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) continue;

            const tag = node.tagName.toLowerCase();

            if (tag === "h1") {
                children.push(
                    new Paragraph({
                        heading: HeadingLevel.HEADING_1,
                        children: [new TextRun({ text: node.textContent, bold: true })],
                    })
                );
            } else if (tag === "h2") {
                children.push(
                    new Paragraph({
                        heading: HeadingLevel.HEADING_2,
                        children: [new TextRun({ text: node.textContent, bold: true })],
                    })
                );
            } else if (tag === "h3") {
                children.push(
                    new Paragraph({
                        heading: HeadingLevel.HEADING_3,
                        children: [new TextRun({ text: node.textContent, bold: true })],
                    })
                );
            } else if (tag === "p" || tag === "div") {
                const runs = [];
                for (const child of node.childNodes) {
                    if (child.nodeType === Node.TEXT_NODE) {
                        runs.push(new TextRun(child.textContent));
                    } else if (child.nodeType === Node.ELEMENT_NODE) {
                        const ct = child.tagName.toLowerCase();
                        runs.push(
                            new TextRun({
                                text: child.textContent,
                                bold: ct === "strong" || ct === "b",
                                italics: ct === "em" || ct === "i",
                                underline: ct === "u" ? {} : undefined,
                            })
                        );
                    }
                }
                if (runs.length) {
                    children.push(new Paragraph({ children: runs }));
                }
            } else if (tag === "ul" || tag === "ol") {
                for (const li of node.querySelectorAll("li")) {
                    children.push(
                        new Paragraph({
                            children: [new TextRun(`• ${li.textContent}`)],
                            indent: { left: 720 },
                        })
                    );
                }
            } else {
                // Recurse for unknown wrappers
                walkNodes(node);
            }
        }
    };

    walkNodes(doc.body);

    if (children.length === 0) {
        children.push(new Paragraph({ children: [new TextRun("")] }));
    }

    const docxDoc = new Document({
        sections: [{ children }],
    });

    const blob = await Packer.toBlob(docxDoc);
    saveAs(blob, "DocFlow_AI_Document.docx");
}
