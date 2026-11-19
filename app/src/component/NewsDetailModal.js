import React from "react";

export default function NewsDetailModal({ isOpen, onClose, news }) {
  if (!isOpen || !news) return null;

  const {
    id,
    headline,
    body,
    image,
    source,
    url,
    voteCount = 0,
    fakeCount = 0,
    aiAnalysis,
  } = news;

  const totalVotes = parseInt(voteCount) + parseInt(fakeCount);
  const authPct = totalVotes > 0 ? ((parseInt(voteCount) / totalVotes) * 100).toFixed(1) : null;
  const fakePct = totalVotes > 0 ? ((parseInt(fakeCount) / totalVotes) * 100).toFixed(1) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3 gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {id !== undefined && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-sky-400">
                  News ID #{id}
                </span>
              )}
              {source && (
                <span className="text-[11px] font-semibold text-slate-400">
                  Origin: <strong className="text-slate-200">{source}</strong>
                </span>
              )}
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white leading-snug">
              {headline}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold p-1 flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Media / Image */}
        {image && (
          <div className="rounded-xl overflow-hidden border border-slate-800 bg-black/50 max-h-80 flex items-center justify-center">
            <img
              src={image}
              alt="News media"
              className="max-h-80 object-contain w-full"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </div>
        )}

        {/* Source Link if from Web URL */}
        {url && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700 text-xs">
            <span className="text-slate-400 truncate max-w-md">Source URL: {url}</span>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap ml-2 transition-colors inline-flex items-center gap-1"
            >
              Open Original Link ↗
            </a>
          </div>
        )}

        {/* Full Text / Body */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Extracted Article / Document Content:
          </label>
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-slate-200 text-sm leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap font-sans">
            {body || headline}
          </div>
        </div>

        {/* Consensus / AI Stats if available */}
        {(totalVotes > 0 || aiAnalysis) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-xs">
            {totalVotes > 0 && (
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                <div className="font-semibold text-sky-400 mb-1">Blockchain Human Consensus</div>
                <div className="text-slate-300">
                  Authentic: <strong>{authPct}%</strong> ({voteCount} votes)
                </div>
                <div className="text-slate-300">
                  Fake: <strong>{fakePct}%</strong> ({fakeCount} votes)
                </div>
              </div>
            )}

            {aiAnalysis && (
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                <div className="font-semibold text-indigo-400 mb-1">AI Classification (NLP)</div>
                <div className="text-slate-300">
                  Prediction:{" "}
                  <strong
                    className={
                      aiAnalysis.prediction === "Authentic"
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }
                  >
                    {aiAnalysis.prediction}
                  </strong>
                </div>
                <div className="text-slate-300">
                  Confidence:{" "}
                  <strong>{((aiAnalysis.confidence || 0.85) * 100).toFixed(0)}%</strong>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-6 py-2 rounded-xl text-xs transition-colors"
          >
            Close Reader
          </button>
        </div>
      </div>
    </div>
  );
}
