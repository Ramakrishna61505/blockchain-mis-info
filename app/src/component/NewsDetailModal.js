import React, { useState, useMemo } from "react";

// Regular expressions for Explainable AI (XAI) linguistic indicators
const SENSATIONAL_REGEX = /\b(shocking|unbelievable|miracle|secret|exposed|banned|hoax|conspiracy|crisis|apocalypse|catastrophe|disaster|panic|must see|jaw-dropping|explosive|scandal|furious|viral)\b/i;
const SPECULATIVE_REGEX = /\b(allegedly|claims?|rumors?|unconfirmed|supposedly|purportedly|sources say|anonymous|speculation|may have|might be|whispers)\b/i;
const INSTITUTIONAL_REGEX = /\b(confirmed|official|spokesperson|reuters|associated press|peer-reviewed|study|researchers?|university|investigation|data show(ed|s)?|documented|published in|statement|evidence)\b/i;

export default function NewsDetailModal({ isOpen, onClose, news }) {
  const [showXAI, setShowXAI] = useState(true);

  const parsedSentences = useMemo(() => {
    if (!news) return [];
    const text = news.body || news.headline || "";
    // Split text into sentences safely
    const rawSentences = text.split(/(?<=[.?!])\s+/).filter(Boolean);

    return rawSentences.map((sentence, index) => {
      const hasSensational = SENSATIONAL_REGEX.test(sentence);
      const hasSpeculative = SPECULATIVE_REGEX.test(sentence);
      const hasInstitutional = INSTITUTIONAL_REGEX.test(sentence);

      let tag = "Neutral";
      let tone = "neutral";
      if (hasSensational) {
        tag = "Sensational / Urgency";
        tone = "sensational";
      } else if (hasSpeculative) {
        tag = "Unverified Claim";
        tone = "speculative";
      } else if (hasInstitutional) {
        tag = "Institutional Attribution";
        tone = "institutional";
      }

      return {
        id: index,
        text: sentence,
        tag,
        tone,
      };
    });
  }, [news]);

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

  // XAI Metrics calculations
  const totalSentences = parsedSentences.length || 1;
  const sensationalCount = parsedSentences.filter((s) => s.tone === "sensational").length;
  const speculativeCount = parsedSentences.filter((s) => s.tone === "speculative").length;
  const institutionalCount = parsedSentences.filter((s) => s.tone === "institutional").length;

  const sensationalRatio = Math.round((sensationalCount / totalSentences) * 100);
  const attributionRatio = Math.round((institutionalCount / totalSentences) * 100);
  const objectivityScore = Math.max(10, Math.min(100, 100 - sensationalRatio - speculativeCount * 15 + attributionRatio * 10));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full p-5 sm:p-7 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3 gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {id !== undefined && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700">
                  News ID #{id}
                </span>
              )}
              {source && (
                <span className="text-[11px] font-semibold text-slate-400">
                  Origin: <strong className="text-slate-200">{source}</strong>
                </span>
              )}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                XAI Explainable AI Active
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white leading-snug">
              {headline}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold p-1.5 rounded-xl hover:bg-slate-800 transition-colors flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Media / Image */}
        {image && (
          <div className="rounded-2xl overflow-hidden border border-slate-800 bg-black/50 max-h-80 flex items-center justify-center">
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
          <div className="flex flex-wrap items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700 text-xs gap-2">
            <span className="text-slate-400 truncate max-w-md">Source URL: {url}</span>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors inline-flex items-center gap-1 shadow-sm"
            >
              Open Original Link ↗
            </a>
          </div>
        )}

        {/* Explainable AI (XAI) Scorecard */}
        <div className="bg-slate-950/80 border border-indigo-900/40 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider font-mono">
                Explainable AI (XAI) Sentence-Level Diagnostics
              </span>
            </div>
            <button
              onClick={() => setShowXAI(!showXAI)}
              type="button"
              className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                showXAI
                  ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {showXAI ? "✓ XAI Highlighting ON" : "Turn ON XAI Highlighting"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">Objectivity Score</span>
              <div className="text-lg font-black text-white flex items-center gap-1.5">
                <span className={objectivityScore >= 70 ? "text-emerald-400" : objectivityScore >= 45 ? "text-amber-400" : "text-rose-400"}>
                  {objectivityScore}%
                </span>
                <span className="text-[10px] font-normal text-slate-400">
                  {objectivityScore >= 70 ? "(Balanced)" : objectivityScore >= 45 ? "(Moderate Bias)" : "(Sensational)"}
                </span>
              </div>
            </div>

            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">Sensationalism Markers</span>
              <div className="text-lg font-black text-rose-400 flex items-center gap-1.5">
                <span>{sensationalCount}</span>
                <span className="text-[10px] font-normal text-slate-400">
                  flagged sentences ({sensationalRatio}%)
                </span>
              </div>
            </div>

            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">Institutional Sourcing</span>
              <div className="text-lg font-black text-emerald-400 flex items-center gap-1.5">
                <span>{institutionalCount}</span>
                <span className="text-[10px] font-normal text-slate-400">
                  attributed claims ({attributionRatio}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Full Text / Body with XAI Sentence Highlighting */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Article Content & Sentence Analysis:
            </label>
            {showXAI && (
              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> Sensational
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Speculative
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Attribution
                </span>
              </div>
            )}
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 max-h-72 overflow-y-auto space-y-2">
            {showXAI ? (
              parsedSentences.map((s) => {
                let badgeClass = "bg-slate-800 text-slate-400 border-slate-700";
                let containerClass = "bg-slate-900/40 border-slate-800/60";

                if (s.tone === "sensational") {
                  badgeClass = "bg-rose-500/20 text-rose-300 border-rose-500/40";
                  containerClass = "bg-rose-950/20 border-l-4 border-rose-500 border-slate-800";
                } else if (s.tone === "speculative") {
                  badgeClass = "bg-amber-500/20 text-amber-300 border-amber-500/40";
                  containerClass = "bg-amber-950/20 border-l-4 border-amber-500 border-slate-800";
                } else if (s.tone === "institutional") {
                  badgeClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
                  containerClass = "bg-emerald-950/20 border-l-4 border-emerald-500 border-slate-800";
                }

                return (
                  <div
                    key={s.id}
                    className={`p-3 rounded-xl border text-sm text-slate-200 transition-all ${containerClass}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-mono text-slate-400">
                        Sentence #{s.id + 1}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeClass}`}>
                        {s.tag}
                      </span>
                    </div>
                    <p className="leading-relaxed">{s.text}</p>
                  </div>
                );
              })
            ) : (
              <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {body || headline}
              </p>
            )}
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
            className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-6 py-2 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Close Reader
          </button>
        </div>
      </div>
    </div>
  );
}
