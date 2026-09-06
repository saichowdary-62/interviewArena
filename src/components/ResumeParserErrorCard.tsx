import React from 'react';
import {
  AlertOctagon,
  Cpu,
  Layers,
  FileX,
  RefreshCw,
  FileText,
  HelpCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { ResumeParserDiagnostics } from '../types';

interface ResumeParserErrorCardProps {
  errorTitle?: string;
  characterCount: number;
  ocrAttempted: boolean;
  rootCause: string;
  diagnostics?: ResumeParserDiagnostics;
  onSwitchToPasteText?: () => void;
  onRetry?: () => void;
}

export const ResumeParserErrorCard: React.FC<ResumeParserErrorCardProps> = ({
  errorTitle = 'PDF parsing failed',
  characterCount = 0,
  ocrAttempted = true,
  rootCause,
  diagnostics,
  onSwitchToPasteText,
  onRetry,
}) => {
  return (
    <div
      id="resume-parser-error-card"
      className="m-6 p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-5 shadow-xs"
    >
      {/* Header */}
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0 mt-0.5">
          <AlertOctagon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-rose-900 tracking-tight">
              {errorTitle}
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-200/80 text-rose-800 border border-rose-300">
              Extraction Pipeline Incomplete
            </span>
          </div>
          <p className="text-xs text-rose-800 mt-1 leading-relaxed">
            All text extraction methods (PDF.js, pdf-parse, and OCR fallback) were attempted sequentially before reporting this failure.
          </p>
        </div>
      </div>

      {/* Required Diagnostic Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Status 1: PDF Parsing */}
        <div className="bg-white/80 p-3.5 rounded-xl border border-rose-200 shadow-2xs">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
            Stream Extraction
          </span>
          <div className="mt-1 flex items-center gap-1.5 font-bold text-rose-900 text-sm">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>PDF Parsing Failed</span>
          </div>
          <span className="text-[11px] text-rose-600 mt-0.5 block">
            Method 1 & 2 yielded &lt; 100 chars
          </span>
        </div>

        {/* Status 2: OCR Fallback Attempted */}
        <div className="bg-white/80 p-3.5 rounded-xl border border-rose-200 shadow-2xs">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
            Vision Fallback
          </span>
          <div className="mt-1 flex items-center gap-1.5 font-bold text-rose-900 text-sm">
            <Cpu className="w-4 h-4 text-amber-600 shrink-0" />
            <span>OCR Fallback Attempted: {ocrAttempted ? 'Yes' : 'No'}</span>
          </div>
          <span className="text-[11px] text-rose-600 mt-0.5 block">
            Rendered pages scanned via Vision
          </span>
        </div>

        {/* Status 3: Character Count Extracted */}
        <div className="bg-white/80 p-3.5 rounded-xl border border-rose-200 shadow-2xs">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
            Extracted Characters
          </span>
          <div className="mt-1 flex items-baseline gap-1.5 font-bold text-rose-900 text-sm">
            <span className="text-lg font-mono leading-none">{characterCount}</span>
            <span className="text-xs font-normal text-rose-600">characters</span>
          </div>
          <span className="text-[11px] text-rose-600 mt-0.5 block">
            Minimum required: 100 characters
          </span>
        </div>
      </div>

      {/* Root Cause Card */}
      <div className="bg-white p-4 rounded-xl border border-rose-200 space-y-1.5">
        <span className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-rose-600" />
          Root Cause Analysis:
        </span>
        <p className="text-xs font-mono text-rose-800 leading-relaxed bg-rose-50/70 p-2.5 rounded-lg border border-rose-200/80 break-words">
          {rootCause || 'No text streams or recognizable OCR characters were extracted from document pages.'}
        </p>
      </div>

      {/* Waterfall Attempts Details (if available) */}
      {diagnostics?.attempts && diagnostics.attempts.length > 0 && (
        <div className="bg-white/70 p-3.5 rounded-xl border border-rose-200">
          <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block mb-2">
            Execution Log:
          </span>
          <div className="space-y-1.5">
            {diagnostics.attempts.map((att, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs font-mono bg-rose-100/50 px-2.5 py-1.5 rounded border border-rose-200/70"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span className="font-semibold text-rose-900">{att.method}:</span>
                  <span className="text-rose-700">{att.error || 'Failed to extract sufficient text'}</span>
                </div>
                <span className="text-rose-600 text-[11px]">{att.charsExtracted} chars</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Guidance */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-rose-200/80">
        <p className="text-xs text-rose-700">
          Tip: Export the PDF with selectable text enabled (not as flattened images), or paste plain text.
        </p>
        <div className="flex items-center gap-2">
          {onSwitchToPasteText && (
            <button
              type="button"
              onClick={onSwitchToPasteText}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 transition shadow-2xs flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Paste Text Directly</span>
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition shadow-2xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Parsing</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
