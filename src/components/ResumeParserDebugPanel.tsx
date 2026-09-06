import React, { useState } from 'react';
import {
  Terminal,
  Cpu,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Layers,
} from 'lucide-react';
import { ResumeParserDiagnostics } from '../types';

interface ResumeParserDebugPanelProps {
  diagnostics: ResumeParserDiagnostics;
  initialOpen?: boolean;
}

export const ResumeParserDebugPanel: React.FC<ResumeParserDebugPanelProps> = ({
  diagnostics,
  initialOpen = true,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(initialOpen);
  const [copied, setCopied] = useState<boolean>(false);

  const copyToClipboard = () => {
    if (!diagnostics.first500Chars) return;
    navigator.clipboard.writeText(diagnostics.first500Chars);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'PDF.js':
        return {
          label: 'PDF.js (Primary Stream Parser)',
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          dot: 'bg-blue-500',
        };
      case 'pdf-parse':
        return {
          label: 'pdf-parse (Secondary Stream Parser)',
          bg: 'bg-purple-50 text-purple-800 border-purple-200',
          dot: 'bg-purple-500',
        };
      case 'OCR Fallback':
        return {
          label: 'OCR Fallback (Page Image Vision)',
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          dot: 'bg-amber-500',
        };
      case 'Direct Text':
        return {
          label: 'Direct Text Input',
          bg: 'bg-slate-100 text-slate-800 border-slate-200',
          dot: 'bg-slate-500',
        };
      default:
        return {
          label: method,
          bg: 'bg-slate-100 text-slate-800 border-slate-200',
          dot: 'bg-slate-500',
        };
    }
  };

  const methodBadge = getMethodBadge(diagnostics.extractionMethodUsed);

  return (
    <div
      id="resume-parser-debug-panel"
      className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-md overflow-hidden"
    >
      {/* Panel Header */}
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 bg-slate-900/90">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                Resume Parser Debug Panel
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                v2.4 Multi-Stage Waterfall
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live extraction pipeline telemetry: PDF.js → pdf-parse → OCR fallback
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* OCR Required Flag */}
          <span
            className={`text-xs px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 ${
              diagnostics.ocrRequired
                ? 'bg-amber-950/40 text-amber-300 border-amber-800/50'
                : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            {diagnostics.ocrRequired ? 'OCR Required (Raster/Scanned)' : 'No OCR Needed (Native Text)'}
          </span>

          {/* Toggle Accordion */}
          <button
            type="button"
            id="toggle-debug-panel-btn"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            aria-label="Toggle parser debug details"
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Diagnostics Content */}
      {isOpen && (
        <div className="p-5 sm:p-6 space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. File Name & Size */}
            <div className="bg-slate-800/50 rounded-xl p-3.5 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                File Details
              </span>
              <div className="mt-1 flex items-baseline gap-1.5 truncate">
                <span className="text-sm font-bold text-slate-100 truncate" title={diagnostics.fileName}>
                  {diagnostics.fileName}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 mt-0.5 block">
                Size: {diagnostics.fileSize}
              </span>
            </div>

            {/* 2. Total Pages */}
            <div className="bg-slate-800/50 rounded-xl p-3.5 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Pages
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-blue-400 leading-none">
                  {diagnostics.totalPages}
                </span>
                <span className="text-xs text-slate-400">page{diagnostics.totalPages !== 1 ? 's' : ''}</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Document pagination count
              </span>
            </div>

            {/* 3. Extracted Character Count */}
            <div className="bg-slate-800/50 rounded-xl p-3.5 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Extracted Characters
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-emerald-400 leading-none">
                  {diagnostics.extractedCharacterCount.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">chars</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {diagnostics.extractedCharacterCount >= 100
                  ? 'Exceeds 100-char threshold'
                  : 'Below 100-char threshold'}
              </span>
            </div>

            {/* 4. Extraction Method Used */}
            <div className="bg-slate-800/50 rounded-xl p-3.5 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Extraction Method Used
              </span>
              <div className="mt-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md bg-blue-900/50 text-blue-300 border border-blue-700/50">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  {diagnostics.extractionMethodUsed}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {diagnostics.extractionMethodUsed === 'PDF.js'
                  ? 'Method 1 resolved payload'
                  : diagnostics.extractionMethodUsed === 'pdf-parse'
                  ? 'Method 2 resolved payload'
                  : 'Method 3 resolved payload'}
              </span>
            </div>
          </div>

          {/* Waterfall Attempt Pipeline Breakdown */}
          {diagnostics.attempts && diagnostics.attempts.length > 0 && (
            <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-400" />
                  Waterfall Pipeline Execution Steps
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Method 1 (PDF.js) → Method 2 (pdf-parse) → Method 3 (OCR)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {diagnostics.attempts.map((attempt, idx) => {
                  const isSuccess = attempt.status === 'success';
                  const isFailed = attempt.status === 'failed';
                  const isSkipped = attempt.status === 'skipped';

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border text-xs transition ${
                        isSuccess
                          ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                          : isFailed
                          ? 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                          : 'bg-slate-900/40 border-slate-800 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold font-mono">
                          Method {idx + 1}: {attempt.method}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-semibold">
                          {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                          {isFailed && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                          {isSkipped && <span className="text-slate-500">Skipped</span>}
                          {attempt.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Extracted: {attempt.charsExtracted} chars</span>
                        {attempt.durationMs !== undefined && (
                          <span className="font-mono">{attempt.durationMs}ms</span>
                        )}
                      </div>

                      {attempt.error && (
                        <p className="mt-1.5 text-[10px] text-rose-300 bg-rose-950/40 p-1.5 rounded border border-rose-900/40">
                          {attempt.error}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* First 500 Extracted Characters */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                First 500 Extracted Characters (Parser Verification)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-mono">
                  {Math.min(diagnostics.first500Chars?.length || 0, 500)} / 500 characters
                </span>
                <button
                  type="button"
                  id="copy-first-500-chars-btn"
                  onClick={copyToClipboard}
                  disabled={!diagnostics.first500Chars}
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>Copy Excerpt</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto max-h-48 scrollbar-thin scrollbar-thumb-slate-800">
              {diagnostics.first500Chars && diagnostics.first500Chars.trim().length > 0 ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-slate-300">
                  {diagnostics.first500Chars}
                </pre>
              ) : (
                <div className="text-slate-500 italic py-2 text-center">
                  No text characters extracted from document stream.
                </div>
              )}
            </div>
          </div>

          {/* Root Cause Diagnostics (if applicable) */}
          {diagnostics.rootCause && (
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Parser Diagnostic Root Cause:</span>
                <p className="mt-0.5 text-amber-300 text-[11px] leading-relaxed">
                  {diagnostics.rootCause}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
