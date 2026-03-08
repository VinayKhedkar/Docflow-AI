"use client";

import { useState } from "react";
import { CheckCircle, ChevronRight } from "lucide-react";

/**
 * ElicitationCard — GenUI multi-field card rendered inside the chat stream.
 *
 * Props:
 *   - fields    : Array<{ id: string, label: string }> — fields to collect
 *   - submitted : boolean — whether the tool result is already resolved
 *   - values    : Record<string, string> — previously submitted values
 *   - onSubmit  : (values: Record<string, string>) => void
 */
export default function ElicitationCard({
    fields = [],
    submitted: externalSubmitted = false,
    values: externalValues = {},
    onSubmit,
}) {
    const [internalValues, setInternalValues] = useState({});
    const [internalSubmitted, setInternalSubmitted] = useState(false);

    const isSubmitted = externalSubmitted || internalSubmitted;
    const displayValues = Object.keys(externalValues).length > 0 ? externalValues : internalValues;

    const handleChange = (fieldId, value) => {
        setInternalValues((prev) => ({ ...prev, [fieldId]: value }));
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        const allFilled = fields.every((f) => internalValues[f.id]?.trim());
        if (!allFilled) return;
        setInternalSubmitted(true);
        onSubmit?.(internalValues);
    };

    return (
        <div className="elicitation-enter" style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-active)",
            borderRadius: "12px",
            padding: "16px 18px",
            maxWidth: "450px",
            boxShadow: "var(--shadow-md)",
        }}>
            {/* Header badge */}
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "10px",
                fontSize: "0.7rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--accent)",
            }}>
                <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: isSubmitted ? "var(--success)" : "var(--accent)",
                    display: "inline-block",
                }} />
                {isSubmitted ? "Resolved" : "Action Required"}
            </div>

            {/* Prompt text */}
            <p style={{
                fontSize: "0.85rem",
                lineHeight: 1.5,
                color: "var(--text-primary)",
                marginBottom: "14px",
            }}>
                Please provide the following information:
            </p>

            {/* Multi-field form */}
            {!isSubmitted && (
                <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {fields.map((field) => (
                        <div key={field.id}>
                            <label style={{
                                display: "block",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                color: "var(--text-secondary)",
                                marginBottom: "4px",
                                textTransform: "capitalize",
                            }}>
                                {field.label}
                            </label>
                            <input
                                type={field.type || "text"}
                                value={internalValues[field.id] || ""}
                                onChange={(e) => handleChange(field.id, e.target.value)}
                                placeholder={`Enter ${field.label.toLowerCase()}...`}
                                style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    borderRadius: "8px",
                                    border: "1px solid var(--border-color)",
                                    background: "var(--bg-input)",
                                    color: "var(--text-primary)",
                                    fontSize: "0.82rem",
                                    outline: "none",
                                    boxSizing: "border-box",
                                    transition: "border-color 0.15s",
                                }}
                                onFocus={(e) => { e.target.style.borderColor = "var(--border-active)"; }}
                                onBlur={(e) => { e.target.style.borderColor = "var(--border-color)"; }}
                            />
                        </div>
                    ))}
                    <button
                        type="submit"
                        style={{
                            padding: "9px 16px",
                            borderRadius: "8px",
                            border: "none",
                            background: "var(--accent)",
                            color: "#fff",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                            transition: "opacity 0.15s",
                            marginTop: "4px",
                        }}
                    >
                        Submit <ChevronRight size={14} />
                    </button>
                </form>
            )}

            {/* Submitted state */}
            {isSubmitted && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        color: "var(--success)",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                    }}>
                        <CheckCircle size={15} />
                        Values submitted
                    </div>
                    {Object.entries(displayValues).map(([key, val]) => (
                        <div key={key} style={{
                            fontSize: "0.75rem",
                            color: "var(--text-secondary)",
                            paddingLeft: "21px",
                        }}>
                            <strong style={{ textTransform: "capitalize" }}>{key.replace(/_/g, " ")}:</strong> {val}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
