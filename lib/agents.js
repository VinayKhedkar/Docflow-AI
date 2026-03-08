/**
 * agents.js — Dual-Mode Swarm: PM, Legal, Sentinel & General Agents
 *
 * Each agent returns:
 *   { type: "MESSAGE" | "ELICITATION" | "DOC_UPDATE", ...payload }
 */

import guidelines from "./guidelines.json";

// ─── Sentinel Agent ────────────────────────────────────────────────
// Scans for India-specific compliance flags in the document text.
// Only fires in Legal mode.
const COMPLIANCE_RULES = [
    {
        pattern: /\bIT Act,?\s*2000\b/i,
        message:
            '🛡️ **Compliance Alert:** This document references the IT Act, 2000 which has been superseded. Should I update references to the **Digital India Act, 2026**?',
        options: ["Yes, update all references", "Keep existing"],
        field: "legislation_update",
    },
    {
        pattern: /\bInformation Technology Act\b/i,
        message:
            '🛡️ **Compliance Alert:** Found reference to the "Information Technology Act". This should be updated to the **Digital India Act, 2026** for current compliance.',
        options: ["Update to Digital India Act", "Keep as-is"],
        field: "legislation_update",
    },
    {
        pattern: /\bGST(?:IN)?\b/i,
        test: (text) => /\bGST(?:IN)?\b/i.test(text) && !/\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]{2}\b/.test(text),
        message:
            "📋 **Missing GSTIN:** The document mentions GST but no valid GSTIN was found. Please provide the GSTIN number.",
        field: "gstin",
        inputType: "text",
        placeholder: "e.g. 22ABCDE1234F1Z5",
    },
    {
        pattern: /\bPAN\b/i,
        test: (text) => /\bPAN\b/i.test(text) && !/\b[A-Z]{5}\d{4}[A-Z]\b/.test(text),
        message:
            "📋 **Missing PAN:** The document references PAN but no valid PAN number was detected.",
        field: "pan",
        inputType: "text",
        placeholder: "e.g. ABCDE1234F",
    },
    {
        pattern: /\bjurisdiction\b/i,
        test: (text) => /\bjurisdiction\b/i.test(text) && !/\b(Mumbai|Delhi|Bengaluru|Chennai|Kolkata|Hyderabad|Pune|Ahmedabad|New Delhi)\b/i.test(text),
        message:
            "📋 **Jurisdiction Missing:** A jurisdiction clause was found but no specific Indian city is mentioned. Please specify the jurisdiction.",
        field: "jurisdiction",
        inputType: "text",
        placeholder: "e.g. New Delhi",
    },
];

export function sentinelScan(docText) {
    if (!docText) return null;
    for (const rule of COMPLIANCE_RULES) {
        if (rule.pattern.test(docText)) {
            const shouldFire = rule.test ? rule.test(docText) : true;
            if (shouldFire) {
                if (rule.options) {
                    return {
                        type: "ELICITATION",
                        subtype: "options",
                        message: rule.message,
                        options: rule.options,
                        field: rule.field,
                    };
                }
                return {
                    type: "ELICITATION",
                    subtype: "form",
                    message: rule.message,
                    field: rule.field,
                    inputType: rule.inputType,
                    placeholder: rule.placeholder,
                };
            }
        }
    }
    return null;
}

// ─── Legal Agent ───────────────────────────────────────────────────
// Generates / modifies clause text & drafts contract sections.
const CLAUSE_TEMPLATES = {
    nda: `<h2>Non-Disclosure Agreement</h2>
<p>This Non-Disclosure Agreement ("Agreement") is entered into as of <strong>[DATE]</strong>, by and between:</p>
<p><strong>Disclosing Party:</strong> [PARTY A NAME], having its registered office at [ADDRESS]</p>
<p><strong>Receiving Party:</strong> [PARTY B NAME], having its registered office at [ADDRESS]</p>
<h3>1. Definition of Confidential Information</h3>
<p>For purposes of this Agreement, "Confidential Information" shall include all information or data disclosed by the Disclosing Party to the Receiving Party, whether orally, in writing, or electronically.</p>
<h3>2. Obligations</h3>
<p>The Receiving Party agrees to hold all Confidential Information in strict confidence and not to disclose such information to any third party without prior written consent.</p>
<h3>3. Term</h3>
<p>This Agreement shall remain in effect for a period of <strong>[DURATION]</strong> from the date of execution.</p>
<h3>4. Governing Law</h3>
<p>This Agreement shall be governed by the laws of India, subject to the jurisdiction of courts in <strong>[JURISDICTION]</strong>.</p>`,

    service: `<h2>Service Agreement</h2>
<p>This Service Agreement ("Agreement") is made effective as of <strong>[DATE]</strong>, by and between:</p>
<p><strong>Service Provider:</strong> [PROVIDER NAME], GSTIN: [GSTIN]</p>
<p><strong>Client:</strong> [CLIENT NAME], GSTIN: [GSTIN]</p>
<h3>1. Scope of Services</h3>
<p>The Service Provider agrees to perform the following services: <strong>[DESCRIPTION]</strong></p>
<h3>2. Compensation</h3>
<p>The Client shall pay the Service Provider ₹<strong>[AMOUNT]</strong> (inclusive of applicable GST) as per the payment schedule outlined below.</p>
<h3>3. Term & Termination</h3>
<p>This Agreement commences on [START DATE] and shall continue until [END DATE], unless terminated earlier by either party with 30 days written notice.</p>
<h3>4. Governing Law</h3>
<p>This Agreement shall be governed by the laws of India, with disputes subject to the exclusive jurisdiction of courts in <strong>[JURISDICTION]</strong>.</p>`,

    employment: `<h2>Employment Agreement</h2>
<p>This Employment Agreement ("Agreement") is entered into on <strong>[DATE]</strong>, by and between:</p>
<p><strong>Employer:</strong> [COMPANY NAME], CIN: [CIN], PAN: [PAN]</p>
<p><strong>Employee:</strong> [EMPLOYEE NAME], PAN: [PAN]</p>
<h3>1. Position & Duties</h3>
<p>The Employee shall serve as <strong>[DESIGNATION]</strong> and perform duties as assigned by the Employer.</p>
<h3>2. Compensation</h3>
<p>The Employee shall receive a monthly gross salary of ₹<strong>[AMOUNT]</strong>, subject to applicable TDS deductions under the Income Tax Act.</p>
<h3>3. Confidentiality</h3>
<p>The Employee shall maintain strict confidentiality regarding all proprietary information encountered during the course of employment.</p>
<h3>4. Termination</h3>
<p>Either party may terminate this Agreement with <strong>[NOTICE PERIOD]</strong> days written notice.</p>`,
};

const INTENT_MAP = [
    { keywords: ["nda", "non-disclosure", "confidentiality agreement"], template: "nda", label: "Non-Disclosure Agreement" },
    { keywords: ["service agreement", "service contract", "consulting agreement", "sow"], template: "service", label: "Service Agreement" },
    { keywords: ["employment", "offer letter", "employment agreement", "hiring"], template: "employment", label: "Employment Agreement" },
];

export function legalAgent(userMessage, currentDocHtml) {
    const lower = userMessage.toLowerCase();

    // Check for template generation
    for (const intent of INTENT_MAP) {
        if (intent.keywords.some((kw) => lower.includes(kw))) {
            return {
                type: "DOC_UPDATE",
                html: CLAUSE_TEMPLATES[intent.template],
                message: `📄 I've drafted a **${intent.label}** template for you. Please review and fill in the bracketed placeholders.`,
            };
        }
    }

    // Check for jurisdiction change
    const jurisdictionMatch = lower.match(/(?:change|set|update)\s+(?:the\s+)?jurisdiction\s+to\s+(.+)/i);
    if (jurisdictionMatch && currentDocHtml) {
        const city = jurisdictionMatch[1].trim().replace(/[.!?]$/, "");
        const capitalized = city.charAt(0).toUpperCase() + city.slice(1);
        const updatedHtml = currentDocHtml.replace(
            /\[JURISDICTION\]/gi,
            capitalized
        );
        return {
            type: "DOC_UPDATE",
            html: updatedHtml,
            message: `✅ Jurisdiction updated to **${capitalized}** across the document.`,
        };
    }

    // Generic field replacement
    const replaceMatch = lower.match(/(?:change|set|update|replace)\s+(?:the\s+)?(\w[\w\s]*?)\s+(?:to|with|as)\s+(.+)/i);
    if (replaceMatch && currentDocHtml) {
        const field = replaceMatch[1].trim().toUpperCase();
        const value = replaceMatch[2].trim().replace(/[.!?]$/, "");
        const placeholder = `[${field}]`;
        if (currentDocHtml.includes(placeholder)) {
            const updatedHtml = currentDocHtml.replaceAll(placeholder, value);
            return {
                type: "DOC_UPDATE",
                html: updatedHtml,
                message: `✅ Updated **${field}** to "${value}" in the document.`,
            };
        }
    }

    return null;
}

// ─── General Agent (LLM Mock) ──────────────────────────────────────
// Handles reports, summaries, emails — no compliance pipeline.
const GENERAL_TEMPLATES = {
    summary: `<h2>Executive Summary</h2>
<p>Prepared on <strong>[DATE]</strong></p>
<h3>Overview</h3>
<p>[SUMMARY CONTENT]</p>
<h3>Key Highlights</h3>
<ul>
<li>[HIGHLIGHT 1]</li>
<li>[HIGHLIGHT 2]</li>
<li>[HIGHLIGHT 3]</li>
</ul>
<h3>Recommendations</h3>
<p>[RECOMMENDATIONS]</p>`,

    report: `<h2>Weekly Status Report</h2>
<p><strong>Report Date:</strong> [DATE]</p>
<p><strong>Prepared by:</strong> [YOUR NAME]</p>
<h3>1. Accomplishments This Week</h3>
<ul>
<li>[ITEM 1]</li>
<li>[ITEM 2]</li>
<li>[ITEM 3]</li>
</ul>
<h3>2. Upcoming Tasks</h3>
<ul>
<li>[TASK 1]</li>
<li>[TASK 2]</li>
</ul>
<h3>3. Blockers & Risks</h3>
<p>[BLOCKERS]</p>`,

    email: `<h2>Professional Email Draft</h2>
<p><strong>To:</strong> [RECIPIENT]</p>
<p><strong>Subject:</strong> [SUBJECT LINE]</p>
<hr/>
<p>Dear [NAME],</p>
<p>[EMAIL BODY]</p>
<p>Please let me know if you have any questions or need further clarification.</p>
<p>Best regards,<br/>[YOUR NAME]<br/>[YOUR TITLE]</p>`,

    memo: `<h2>Internal Memo</h2>
<p><strong>Date:</strong> [DATE]</p>
<p><strong>To:</strong> [RECIPIENTS]</p>
<p><strong>From:</strong> [YOUR NAME]</p>
<p><strong>Subject:</strong> [SUBJECT]</p>
<hr/>
<p>[MEMO CONTENT]</p>
<h3>Action Items</h3>
<ul>
<li>[ACTION 1]</li>
<li>[ACTION 2]</li>
</ul>`,
};

const GENERAL_INTENT_MAP = [
    { keywords: ["summarize", "summary", "executive summary", "brief"], template: "summary", label: "Executive Summary" },
    { keywords: ["report", "weekly update", "status update", "status report"], template: "report", label: "Weekly Status Report" },
    { keywords: ["email", "draft email", "write email", "compose email", "mail"], template: "email", label: "Professional Email" },
    { keywords: ["memo", "internal memo", "memorandum", "notice"], template: "memo", label: "Internal Memo" },
];

export function callGeneralLLM(userMessage, currentDocHtml) {
    const lower = userMessage.toLowerCase();

    // Check for general template match
    for (const intent of GENERAL_INTENT_MAP) {
        if (intent.keywords.some((kw) => lower.includes(kw))) {
            return {
                type: "DOC_UPDATE",
                html: GENERAL_TEMPLATES[intent.template],
                message: `📝 Here's a **${intent.label}** template. Fill in the bracketed placeholders to customize it.`,
            };
        }
    }

    // Spelling / grammar check request
    if (lower.includes("spelling") || lower.includes("grammar") || lower.includes("proofread")) {
        return {
            type: "MESSAGE",
            message: "✅ I've reviewed the document. **No major spelling or grammar issues found.** The tone is professional and appropriate for formal correspondence.",
        };
    }

    // Generic field replacement (same as legal)
    const replaceMatch = lower.match(/(?:change|set|update|replace)\s+(?:the\s+)?(\w[\w\s]*?)\s+(?:to|with|as)\s+(.+)/i);
    if (replaceMatch && currentDocHtml) {
        const field = replaceMatch[1].trim().toUpperCase();
        const value = replaceMatch[2].trim().replace(/[.!?]$/, "");
        const placeholder = `[${field}]`;
        if (currentDocHtml.includes(placeholder)) {
            const updatedHtml = currentDocHtml.replaceAll(placeholder, value);
            return {
                type: "DOC_UPDATE",
                html: updatedHtml,
                message: `✅ Updated **${field}** to "${value}" in the document.`,
            };
        }
    }

    // Fallback
    const fallbacks = [
        "I'm in **General mode** — I can help you draft reports, summaries, emails, and memos. Try saying **\"Draft a weekly report\"** or **\"Write an email\"**.",
        "Need a summary, report, or email? Just tell me what you'd like to create! Switch to **Legal mode** for contracts and NDAs.",
        "I can draft professional documents for you. Try **\"Summarize this report\"** or **\"Draft an internal memo\"**. For legal documents, toggle on **Legal mode**.",
    ];
    return {
        type: "MESSAGE",
        message: fallbacks[Math.floor(Math.random() * fallbacks.length)],
    };
}

// ─── PM Agent ──────────────────────────────────────────────────────
// Orchestrator: understands intent, delegates to Legal or General.
const LEGAL_FALLBACKS = [
    "I can help you draft legal documents like NDAs, Service Agreements, and Employment Agreements. Just tell me what you need!",
    "Try saying something like **\"Draft an NDA\"** or **\"Create a service agreement\"** to get started.",
    "I'm your DocFlow AI legal assistant. I can draft documents, update fields, and check compliance. What would you like to do?",
];

export function pmAgent(userMessage, currentDocHtml) {
    // First, try the legal agent
    const legalResult = legalAgent(userMessage, currentDocHtml);
    if (legalResult) return legalResult;

    // Quick NL field updates (e.g. "My PAN is ABCDE1234F")
    const panMatch = userMessage.match(/(?:my\s+)?PAN\s+(?:is|number[:\s]*)\s*([A-Z]{5}\d{4}[A-Z])/i);
    if (panMatch && currentDocHtml) {
        const pan = panMatch[1].toUpperCase();
        const updatedHtml = currentDocHtml.replaceAll("[PAN]", pan);
        return {
            type: "DOC_UPDATE",
            html: updatedHtml,
            message: `✅ PAN updated to **${pan}** in the document.`,
        };
    }

    const gstinMatch = userMessage.match(/(?:my\s+)?GSTIN?\s+(?:is|number[:\s]*)\s*(\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]{2})/i);
    if (gstinMatch && currentDocHtml) {
        const gstin = gstinMatch[1].toUpperCase();
        const updatedHtml = currentDocHtml.replaceAll("[GSTIN]", gstin);
        return {
            type: "DOC_UPDATE",
            html: updatedHtml,
            message: `✅ GSTIN updated to **${gstin}** in the document.`,
        };
    }

    // Fallback
    return {
        type: "MESSAGE",
        message: LEGAL_FALLBACKS[Math.floor(Math.random() * LEGAL_FALLBACKS.length)],
    };
}
