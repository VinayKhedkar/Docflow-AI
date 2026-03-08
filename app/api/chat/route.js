import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, tool, stepCountIs, convertToModelMessages } from "ai";
import { z } from "zod";
import guidelines from "../../../lib/guidelines.json";

// ─── System Prompt Architecture ────────────────────────────────────
const getSystemPrompt = (isLegalMode) => {
  if (isLegalMode) {
    return `You are a Senior Indian Legal Counsel powering DocFlow AI — an India-specific AI assistant for drafting legally compliant documents for SMEs.

YOU HAVE TWO TOOLS:
1. request_missing_info({ fields }) — Call this to collect mandatory information from the user via a form card. Each field has { id, label }.
2. set_document({ html, title }) — Call this to push a finished document into the editor.

*** CRITICAL WORKFLOW — YOU MUST FOLLOW THIS EXACT ORDER ***
Step 1: When the user asks you to draft ANY document, you MUST FIRST call request_missing_info to collect ALL required details. NEVER skip this step. NEVER use placeholder text like [COMPANY NAME] when you could ask for the real value.
Step 2: Wait for the user to fill in the form and submit.
Step 3: Only AFTER receiving the user's filled-in values, draft the complete document and call set_document.

MINIMUM FIELDS TO ALWAYS COLLECT (if not already provided by the user):
- Party names (party_a_name, party_b_name) — "First Party Name", "Second Party Name"
- Jurisdiction (jurisdiction) — "Jurisdiction City (e.g., Mumbai, Delhi)"
- Date (effective_date) — "Effective Date"
- For contracts involving money: amount, currency
- For legal entities: GSTIN (gstin), PAN (pan_number)
- For employment: designation, salary, probation period
- For NDAs: confidentiality_period, governing_law

EXAMPLE — If user says "Draft an NDA":
You call: request_missing_info({ fields: [
  { id: "party_a_name", label: "Disclosing Party Name" },
  { id: "party_b_name", label: "Receiving Party Name" },
  { id: "effective_date", label: "Effective Date" },
  { id: "confidentiality_period", label: "Confidentiality Period (e.g., 2 years)" },
  { id: "jurisdiction", label: "Jurisdiction City" }
] })

COMPLIANCE GUIDELINES:
${JSON.stringify(guidelines, null, 2)}

KEY LEGAL RULES:
- Use BNS (Bharatiya Nyaya Sanhita, 2023) instead of IPC. For criminal breach of trust, reference BNS Section 316 (replacing old IPC 405).
- Prioritize DPDP Act 2023 compliance for any data protection / personal data clauses. Reference Section 4 (Consent) and Section 8 (Rights of Data Principal).
- Reference the Digital India Act, 2026 (NOT the old IT Act, 2000).
- Use INR (₹) for monetary values. Mention GST where applicable.
- Always include a Governing Law clause with a specific Indian city jurisdiction.

ADDITIONAL RULES:
- For conversational replies (greetings, questions, clarifications): respond in plain markdown text only. Do NOT call any tools.
- After calling set_document, give a brief 1-2 sentence summary of the document.
- Use [PLACEHOLDER] brackets ONLY for truly optional values that are not worth collecting.

DOCUMENT HTML FORMAT: Use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags.`;
  }
  return `You are a professional assistant powering DocFlow AI — an AI writing assistant for Indian SMEs.
You help draft reports, summaries, emails, memos, and general business documents.

YOU HAVE TWO TOOLS:
1. request_missing_info({ fields }) — Call this to collect required information from the user via a form card. Each field has { id, label }.
2. set_document({ html, title }) — Call this to push a finished document into the editor.

*** CRITICAL WORKFLOW — YOU MUST FOLLOW THIS EXACT ORDER ***
Step 1: When the user asks you to draft ANY document, you MUST FIRST call request_missing_info to collect ALL key details that the user has NOT already provided. NEVER skip this step. NEVER use placeholder text like [COMPANY NAME] or [RECIPIENT] when you could ask for the real value.
Step 2: Wait for the user to fill in the form and submit.
Step 3: Only AFTER receiving the user's filled-in values, draft the complete document and call set_document.

FIELDS TO COLLECT (based on document type):
- For emails: recipient_name, sender_name, subject, key_points
- For reports/updates: report_title, author_name, department, date, summary_topic
- For memos: from_name, to_name, date, subject, key_message
- For letters: company_name, recipient_name, date, purpose
- For weekly updates: author_name, week_ending_date, department, key_achievements, upcoming_tasks
- General: any names, dates, amounts, or specifics needed for the document

EXAMPLE — If user says "Draft a weekly update":
You call: request_missing_info({ fields: [
  { id: "author_name", label: "Your Name" },
  { id: "department", label: "Department" },
  { id: "week_ending_date", label: "Week Ending Date" },
  { id: "key_achievements", label: "Key Achievements This Week" },
  { id: "upcoming_tasks", label: "Upcoming Tasks Next Week" }
] })

ADDITIONAL RULES:
- For conversational replies (greetings, questions, clarifications): respond in plain markdown text only. Do NOT call any tools.
- After calling set_document, give a brief confirming summary.
- Use INR (₹) for all monetary values.
- Be concise and professional.

DOCUMENT HTML FORMAT: Use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags.`;
};

// ─── Tool Definitions ──────────────────────────────────────────────
const tools = {
  request_missing_info: tool({
    description:
      "MANDATORY: Call this tool FIRST before drafting any document. Collects required information from the user via an interactive form.",
    parameters: z.object({
      fields: z.array(
        z.object({
          id: z.string().describe("Machine-readable field key"),
          label: z.string().describe("Human-readable label shown to the user"),
          type: z.enum(["text", "date", "number"]).optional().default("text").describe("Input type"),
        })
      ).describe("Array of fields to collect from the user."),
    }),
  }),

  set_document: tool({
    description:
      "Push a complete document as HTML into the user's document editor. Call this once the document is ready.",
    parameters: z.object({
      html: z.string().describe("Full document HTML using h2, h3, p, ul, li, strong tags"),
      title: z.string().optional().describe("Document title for display"),
    }),
  }),
};

// ─── API Route ─────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const body = await req.json();
    const { messages = [], mode = "general", currentDocument = "" } = body;
    console.log("[Chat API] mode:", mode, "messages:", messages.length, "hasDoc:", !!currentDocument);

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "GOOGLE_GENERATIVE_AI_API_KEY not set" }, { status: 500 });
    }

    const google = createGoogleGenerativeAI({ apiKey });

    // Convert UI messages (parts-based) to model messages for streamText
    const modelMessages = await convertToModelMessages(messages, { tools });
    console.log("[Chat API] Converted", modelMessages.length, "model messages");

    // Build system prompt with current document context if available
    let systemPrompt = getSystemPrompt(mode === "legal");
    if (currentDocument) {
      systemPrompt += `\n\n──── CURRENT DOCUMENT IN EDITOR ────\nThe user's editor currently contains the following document. When the user asks to modify, update, or change anything about the document, update the HTML accordingly and call set_document with the full updated HTML. Always preserve existing content unless the user explicitly asks to remove it.\n\n${currentDocument}\n──── END OF CURRENT DOCUMENT ────`;
    }

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[Chat API] Error:", error?.message || error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
