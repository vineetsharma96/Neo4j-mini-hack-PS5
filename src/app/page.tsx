"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  GitBranch,
  KeyRound,
  FileCheck2,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Brand } from "@/components/brand";
export default function Welcome() {
  const reduced = useReducedMotion();
  return (
    <div className="welcome">
      <header className="welcome-nav">
        <Link href="/" aria-label="TraceReason home">
          <Brand />
        </Link>
        <span className="nav-caption">CONNECTED PROJECT MEMORY</span>
        <Link href="/auth" className="quiet-link">
          Sign in <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </header>
      <main id="main" className="welcome-main">
        <motion.div
          initial={false}
          animate={{
            opacity: reduced ? 1 : [0.96, 1],
            y: reduced ? 0 : [10, 0],
          }}
          transition={{ duration: 0.45 }}
          className="welcome-copy"
        >
          <div className="eyebrow">
            <span className="status-dot" /> CONTEXT THAT STAYS WITH YOUR CODE
          </div>
          <h1>
            Your codebase
            <br />
            remembers <span>why.</span>
          </h1>
          <p className="welcome-description">
            The decision. The bug. The fix.
            <br />
            Connect your project’s history to the problem in front of you.
          </p>
          <div className="welcome-actions">
            <Link href="/app?mode=demo" className="button primary">
              Explore demo <ArrowUpRight aria-hidden="true" size={18} />
            </Link>
            <Link href="/auth" className="button secondary">
              Sign in to your workspace{" "}
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
          </div>
          <p className="demo-disclosure">
            No account needed. Fictional project. Real connections.
          </p>
        </motion.div>
        <motion.div
          className="memory-preview"
          initial={false}
          animate={{ opacity: reduced ? 1 : [0.96, 1] }}
          transition={{ delay: 0.15, duration: 0.5 }}
          aria-label="Connected memory preview: an authentication decision links to a prior 401 and its validation fix"
        >
          <div className="preview-label">
            <GitBranch aria-hidden="true" size={15} /> A CHANGE LEAVES A TRACE
          </div>
          <div className="preview-line line-a" />
          <div className="preview-line line-b" />
          <div className="preview-line line-c" />
          <div className="preview-record preview-decision">
            <span className="record-type">
              <GitBranch size={15} aria-hidden="true" /> DECISION
            </span>
            <strong>Change token handling</strong>
            <span>Short-lived tokens. Persistent sessions.</span>
            <div className="preview-record-footer">
              The reasoning is still here{" "}
              <ChevronRight size={14} aria-hidden="true" />
            </div>
          </div>
          <div className="preview-record preview-auth">
            <KeyRound size={21} aria-hidden="true" />
            <div>
              <small>COMPONENT</small>
              <strong>Authentication</strong>
            </div>
          </div>
          <div className="preview-record preview-bug">
            <span className="record-type">BUG · RESOLVED</span>
            <strong>API returned 401</strong>
            <span>Connected to token validation</span>
          </div>
          <div className="preview-record preview-fix">
            <FileCheck2 size={20} aria-hidden="true" />
            <div>
              <small>FIX</small>
              <strong>Align token validation</strong>
            </div>
          </div>
          <div className="preview-caption">
            <span className="status-dot" /> Every connection has a story.
          </div>
        </motion.div>
      </main>
      <footer className="welcome-footer">
        <span>
          <ShieldCheck size={16} aria-hidden="true" /> Evidence first.
          Hypotheses clearly marked.
        </span>
        <span>BUILT FOR THE NEXT “WHY?”</span>
      </footer>
    </div>
  );
}
