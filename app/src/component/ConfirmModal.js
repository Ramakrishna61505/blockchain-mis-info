import React, { useEffect } from 'react';
import {
  CheckCircleIcon,
  ExclamationIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/outline';

/**
 * Modern Web3 Confirmation & Alert Modal
 * Replaces native browser window.confirm / alert with animated glassmorphism UI.
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'confirm', // 'confirm' | 'success' | 'danger' | 'warning' | 'info'
  confirmText = 'Confirm & Sign',
  cancelText = 'Cancel',
  headline,
  newsId,
  verdict, // 'AUTHENTIC' | 'FAKE' | null
  isProcessing = false,
  processingText = 'Signing transaction on MetaMask...',
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const isVerdictFake = verdict === 'FAKE' || verdict?.toLowerCase().includes('fake');
  const isVerdictAuthentic = verdict === 'AUTHENTIC' || verdict?.toLowerCase().includes('authentic');

  // Icon selector based on type or verdict
  let iconComponent = (
    <div className="h-12 w-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
      <InformationCircleIcon className="h-7 w-7" />
    </div>
  );

  if (isVerdictFake || type === 'danger') {
    iconComponent = (
      <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
        <ExclamationIcon className="h-7 w-7" />
      </div>
    );
  } else if (isVerdictAuthentic || type === 'success') {
    iconComponent = (
      <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
        <CheckCircleIcon className="h-7 w-7" />
      </div>
    );
  } else if (type === 'warning') {
    iconComponent = (
      <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
        <ExclamationIcon className="h-7 w-7" />
      </div>
    );
  }

  // Button theme styling
  let confirmBtnClass = 'bg-sky-600 hover:bg-sky-500 text-white';
  if (isVerdictFake || type === 'danger') {
    confirmBtnClass = 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/30';
  } else if (isVerdictAuthentic || type === 'success') {
    confirmBtnClass = 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle decorative top glow */}
        <div
          className={`absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-24 rounded-full blur-3xl pointer-events-none opacity-25 ${
            isVerdictFake ? 'bg-rose-500' : isVerdictAuthentic ? 'bg-emerald-500' : 'bg-sky-500'
          }`}
        />

        {/* Content Container */}
        <div className="relative space-y-5">
          {/* Header row: Icon & Title */}
          <div className="flex items-start gap-4">
            {iconComponent}
            <div className="flex-1">
              <h3 className="text-xl font-extrabold text-white leading-tight">
                {title || 'Confirm Action'}
              </h3>
              {newsId !== undefined && (
                <span className="inline-block mt-1 text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Article #{newsId}
                </span>
              )}
            </div>
            {!isProcessing && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors text-lg"
                title="Close"
              >
                ✕
              </button>
            )}
          </div>

          {/* Headline Preview Box (if provided) */}
          {headline && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                News Statement Under Review
              </span>
              <p className="text-sm text-slate-200 font-medium italic line-clamp-3">
                "{headline}"
              </p>
            </div>
          )}

          {/* Verdict Highlight Pill (if evaluation action) */}
          {verdict && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-xs">
              <span className="text-slate-300 font-medium">Your Selected Verdict:</span>
              {isVerdictAuthentic ? (
                <span className="inline-flex items-center gap-1.5 font-bold px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <ShieldCheckIcon className="h-4 w-4" />
                  AUTHENTIC / REAL NEWS
                </span>
              ) : isVerdictFake ? (
                <span className="inline-flex items-center gap-1.5 font-bold px-3 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  <ExclamationIcon className="h-4 w-4" />
                  FAKE / MISINFORMATION
                </span>
              ) : (
                <span className="font-bold text-white">{verdict}</span>
              )}
            </div>
          )}

          {/* Detailed Message / Description */}
          {message && (
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {message}
            </p>
          )}

          {/* Blockchain & Gas Notice (for confirmation mode) */}
          {type === 'confirm' && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-800/40 px-3 py-2 rounded-xl border border-slate-800">
              <span className="text-sm">⛽</span>
              <span>
                Submitting this vote writes an immutable record to the Ethereum blockchain via MetaMask.
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
            {type === 'confirm' && (
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {cancelText}
              </button>
            )}

            <button
              type="button"
              onClick={onConfirm || onClose}
              disabled={isProcessing}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 ${confirmBtnClass}`}
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>{processingText}</span>
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
