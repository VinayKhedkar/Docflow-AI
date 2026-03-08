"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Shield,
  FileText,
  Mic,
  Bot,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Check,
} from "lucide-react";
import Image from "next/image";

// ─── Animated counter ────────────────────────────────────────────
function AnimatedNumber({ target, suffix = "", duration = 2000 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const step = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

// ─── Floating orb background ─────────────────────────────────────
function FloatingOrbs() {
  return (
    <div className="landing-orbs" aria-hidden="true">
      <div className="landing-orb orb-1" />
      <div className="landing-orb orb-2" />
      <div className="landing-orb orb-3" />
    </div>
  );
}

// ─── Agent step (for pipeline visual) ────────────────────────────
function AgentStep({ icon, label, sublabel, active, done, delay }) {
  return (
    <div
      className={`landing-agent-step ${active ? "active" : ""} ${done ? "done" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="landing-agent-icon">{icon}</div>
      <div className="landing-agent-info">
        <span className="landing-agent-label">{label}</span>
        <span className="landing-agent-sublabel">{sublabel}</span>
      </div>
      <div className="landing-agent-status">
        {done && <Check size={14} />}
        {active && <div className="landing-spinner" />}
      </div>
    </div>
  );
}

// ─── Feature card ────────────────────────────────────────────────
function FeatureCard({ icon, title, description }) {
  return (
    <div className="landing-feature-card">
      <div className="landing-feature-icon">{icon}</div>
      <h3 className="landing-feature-title">{title}</h3>
      <p className="landing-feature-desc">{description}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
export default function LandingPage() {
  const [agentStep, setAgentStep] = useState(0);

  // Cycle through agent steps
  useEffect(() => {
    const interval = setInterval(() => {
      setAgentStep((s) => (s >= 3 ? 0 : s + 1));
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="landing-root">
      <FloatingOrbs />

      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="landing-nav backdrop-blur-lg">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <img src="/logo.png" alt="DocFlow AI" width={35} height={35} />
            <span className="text-[2rem]">DocFlow AI</span>
          </div>
          <div className="landing-nav-links">
            <Link href="/docflow-desk" className="landing-nav-cta">
              Launch App <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          {/* Left copy */}
          <div className="landing-hero-copy">
            <div className="landing-badge">
              <Sparkles size={13} />
              <span>AI-Powered Legal Drafting for India</span>
            </div>

            <h1 className="landing-h1">
              Draft Legal Documents
              <br />
              <span className="landing-h1-accent">in Minutes, Not Hours</span>
            </h1>

            <p className="landing-subtitle">
              DocFlow AI is an agentic workspace that combines multi-agent
              orchestration, generative UI, voice commands, and India-specific
              legal compliance — all in one interface.
            </p>

            <div className="landing-cta-group">
              <Link href="/docflow-desk" className="landing-cta-primary">
                Start Drafting <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {/* Right — Live Agent Pipeline Visual */}
          <div className="landing-hero-visual">
            <div className="landing-visual-card">
              <div className="landing-visual-header">
                <div className="landing-visual-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="landing-visual-title">Agent Pipeline</span>
              </div>

              {/* Simulated chat message */}
              <div className="landing-visual-chat">
                <div className="landing-visual-user-msg">
                  &ldquo;Draft an NDA for my startup&rdquo;
                </div>
                <div className="landing-visual-bot-row">
                  <div className="landing-visual-avatar">
                    <Bot size={14} />
                  </div>
                  <div className="landing-visual-pipeline">
                    <AgentStep
                      icon="🧭"
                      label="PM Agent"
                      sublabel="Routing"
                      done={agentStep > 0}
                      active={agentStep === 0}
                      delay={0}
                    />
                    <div
                      className={`landing-connector ${agentStep > 0 ? "done" : ""}`}
                    />
                    <AgentStep
                      icon="⚖️"
                      label="Legal Agent"
                      sublabel="Drafting"
                      done={agentStep > 1}
                      active={agentStep === 1}
                      delay={200}
                    />
                    <div
                      className={`landing-connector ${agentStep > 1 ? "done" : ""}`}
                    />
                    <AgentStep
                      icon="🛡️"
                      label="Sentinel"
                      sublabel="Compliance"
                      done={agentStep > 2}
                      active={agentStep === 2}
                      delay={400}
                    />
                  </div>
                </div>
              </div>

              {/* Simulated elicitation card */}
              <div
                className={`landing-visual-elicitation ${agentStep >= 3 ? "visible" : ""}`}
              >
                <div className="landing-elicit-header">
                  <div className="landing-elicit-dot" />
                  <span>Action Required</span>
                </div>
                <div className="landing-elicit-fields">
                  <div className="landing-elicit-field">
                    <span>Party A Name</span>
                    <div className="landing-elicit-input">Acme Corp</div>
                  </div>
                  <div className="landing-elicit-field">
                    <span>Jurisdiction</span>
                    <div className="landing-elicit-input">Mumbai</div>
                  </div>
                </div>
                <div className="landing-elicit-btn">Submit</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section className="landing-features" id="features">
        <div className="landing-features-inner">
          <FeatureCard
            icon={<Bot size={22} />}
            title="Multi-Agent Pipeline"
            description="PM Agent routes, Legal Agent drafts with Gemini 2.5 Flash, Sentinel scans for compliance — all orchestrated automatically."
          />
          <FeatureCard
            icon={<FileText size={22} />}
            title="Generative UI"
            description="AI renders interactive form cards inline in chat. Fill in party names, GSTIN, PAN — the document updates in real-time."
          />
          <FeatureCard
            icon={<Mic size={22} />}
            title="Voice Commands"
            description="Speak naturally to draft documents. ElevenLabs voice agent captures speech and feeds it to the full agent pipeline."
          />
          <FeatureCard
            icon={<Shield size={22} />}
            title="India-Specific Compliance"
            description="Built-in knowledge of BNS 2023, DPDP Act, Digital India Act 2026, CGST Act, and 26 statutory references."
          />
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-logo">
            <img src="/logo.png" alt="DocFlow AI" width={18} height={18} />
            <span>DocFlow AI</span>
          </div>
          <p>Built for Indian SMEs. Powered by Gemini & ElevenLabs.</p>
        </div>
      </footer>
    </div>
  );
}
