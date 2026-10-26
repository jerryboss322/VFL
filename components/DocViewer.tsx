"use client";

import React, { useState } from "react";

export interface RfcDocument {
  id: string;
  number: string;
  title: string;
  status: string;
  category: string;
  authors: string;
  abstract: string;
  contentMarkdown: string;
}

interface DocViewerProps {
  rfc: RfcDocument;
}

export function DocViewer({ rfc }: DocViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(rfc.contentMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="rounded-xl border border-line bg-graphite overflow-hidden shadow-sm">
      {/* RFC Header Metadata */}
      <div className="border-b border-line bg-charcoal p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-accent/20 text-accent border border-accent/30 px-2.5 py-0.5 text-xs font-mono font-bold">
              RFC {rfc.number}
            </span>
            <span className="rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-xs font-mono font-bold">
              {rfc.status.toUpperCase()}
            </span>
            <span className="rounded bg-line px-2 py-0.5 text-xs font-mono text-fog">
              {rfc.category}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="rounded bg-line px-3 py-1.5 text-xs font-mono font-semibold text-white hover:bg-line/80 transition"
          >
            {copied ? "Copied Markdown ✓" : "Copy Markdown"}
          </button>
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-white">{rfc.title}</h1>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-fog pt-1 border-t border-line/40">
          <div>
            <span>Authors: </span>
            <strong className="text-bone">{rfc.authors}</strong>
          </div>
          <div>
            <span>Format: </span>
            <strong className="text-bone">GFM Technical Specification</strong>
          </div>
        </div>
      </div>

      {/* Abstract Banner */}
      <div className="p-6 bg-ink/40 border-b border-line/60">
        <span className="text-[10px] font-mono uppercase tracking-wider text-accent block mb-1">
          Executive Abstract
        </span>
        <p className="text-xs text-zinc-300 leading-relaxed font-sans">{rfc.abstract}</p>
      </div>

      {/* Markdown Content Display */}
      <div className="p-6 text-xs text-bone leading-relaxed space-y-4 font-mono whitespace-pre-wrap select-text bg-ink/20 overflow-x-auto">
        {rfc.contentMarkdown}
      </div>
    </article>
  );
}
