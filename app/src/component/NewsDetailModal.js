import React, { useState, useMemo } from "react";

// Regular expressions for Explainable AI (XAI) linguistic indicators
const SENSATIONAL_REGEX = /\b(shocking|unbelievable|miracle|secret|exposed|banned|hoax|conspiracy|crisis|apocalypse|catastrophe|disaster|panic|must see|jaw-dropping|explosive|scandal|furious|viral)\b/i;
const SPECULATIVE_REGEX = /\b(allegedly|claims?|rumors?|unconfirmed|supposedly|purportedly|sources say|anonymous|speculation|may have|might be|whispers)\b/i;
const INSTITUTIONAL_REGEX = /\b(confirmed|official|spokesperson|reuters|associated press|peer-reviewed|study|researchers?|university|investigation|data show(ed|s)?|documented|published in|statement|evidence)\b/i;

export default function NewsDetailModal({ isOpen, onClose, news }) {
  const [showXaiDetails, setShowXaiDetails] = useState(true);

  // Extract and analyze sentences for the dedicated XAI section
  const xaiFindings = useMemo(() => {
    if (!news) return { flaggedSentences: [], totalSentences: 0, sensationalCount: 0, speculativeCount: 0, institutionalCount: 0, objectivityScore: 100 };
    const text = news.body || news.headline || "";
    const rawSentences = text.split(/(?<=[.?!])\s+/).filter(Boolean);

    let sensationalCount = 0;
    let speculativeCount = 0;
    let institutionalCount = 0;
    const flaggedSentences = [];

    rawSentences.forEach((sentence, index) => {
      const hasSensational = SENSATIONAL_REGEX.test(sentence);
      const hasSpeculative = SPECULATIVE_REGEX.test(sentence);
      const hasInstitutional = INSTITUTIONAL_REGEX.test(sentence);

      if (hasSensational || hasSpeculative || hasInstitutional) {
        let tag = "Neutral";
        let tone = "neutral";
        if (hasSensational) {
          tag = "Sensational / Emotional Urgency";
          tone = "sensational";
          sensationalCount++;
        } else if (hasSpeculative) {
          tag = "Unverified Claim / Speculation";
          tone = "speculative";
          speculativeCount++;
        } else if (hasInstitutional) {
          tag = "Institutional Sourcing & Attribution";
          tone = "institutional";
          institutionalCount++;
        }

        flaggedSentences.push({
          id: index + 1,
          text: sentence.trim(),
          tag,
          tone,
        });
      }
    });

    const totalSentences = rawSentences.length || 1;
    const sensationalRatio = Math.round((sensationalCount / totalSentences) * 100);
    const attributionRatio = Math.round((institutionalCount / totalSentences) * 100);
    const objectivityScore = Math.max(10, Math.min(100, 100 - sensationalRatio - speculativeCount * 15 + attributionRatio * 10));

    return {
      flaggedSentences,
      totalSentences,
      sensationalCount,
      speculativeCount,
      institutionalCount,
      sensationalRatio,
      attributionRatio,
      objectivityScore,
    };
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full p-5 sm:p-7 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
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

        {/* 1. DOCUMENT CONTENT (Shown as it was posted, continuous text, NOT in boxes) */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Article / Document Content:
          </label>
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 text-slate-200 text-sm leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap font-sans shadow-inner selection:bg-sky-500 selection:text-white">
            {body || headline}
          </div>
        </div>

        {/* 2. DEDICATED SEPARATE SECTION: EXPLAINABLE AI (XAI) DIAGNOSTICS */}
        <div className="bg-slate-950/80 border border-indigo-900/50 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-indigo-400 animate-pulse" />
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>🧠 Explainable AI (XAI) Linguistic Diagnostics</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Transparent breakdown of model linguistic heuristics, sentiment intensity, and source verifiability.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowXaiDetails(!showXaiDetails)}
              type="button"
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 transition-colors cursor-pointer"
            >
              {showXaiDetails ? "Hide XAI Findings ▲" : "Show XAI Findings ▼"}
            </button>
          </div>

          {/* XAI Quantitative Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">Objectivity Score</span>
              <div className="text-lg font-black text-white flex items-center gap-1.5">
                <span
                  className={
                    xaiFindings.objectivityScore >= 70
                      ? "text-emerald-400"
                      : xaiFindings.objectivityScore >= 45
                      ? "text-amber-400"
                      : "text-rose-400"
                  }
                >
                  {xaiFindings.objectivityScore}%
                </span>
                <span className="text-[10px] font-normal text-slate-400">
                  {xaiFindings.objectivityScore >= 70
                    ? "(Objective & Balanced)"
                    : xaiFindings.objectivityScore >= 45
                    ? "(Moderate Subjectivity)"
                    : "(Highly Sensational)"}
                </span>
              </div>
            </div>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">Sensationalism Markers</span>
              <div className="text-lg font-black text-rose-400 flex items-center gap-1.5">
                <span>{xaiFindings.sensationalCount}</span>
                <span className="text-[10px] font-normal text-slate-400">
                  flagged phrases ({xaiFindings.sensationalRatio || 0}%)
                </span>
              </div>
            </div>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">Institutional Sourcing</span>
              <div className="text-lg font-black text-emerald-400 flex items-center gap-1.5">
                <span>{xaiFindings.institutionalCount}</span>
                <span className="text-[10px] font-normal text-slate-400">
                  verified citations ({xaiFindings.attributionRatio || 0}%)
                </span>
              </div>
            </div>
          </div>

          {/* XAI Flagged Sentences List (Only shows flagged sentences, cleanly highlighted) */}
          {showXaiDetails && (
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <span className="text-xs font-semibold text-slate-300 block mb-1">
                Linguistic Findings & Detected Semantic Flags:
              </span>
              {xaiFindings.flaggedSentences.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {xaiFindings.flaggedSentences.map((item) => {
                    let badgeClass = "bg-slate-800 text-slate-300 border-slate-700";
                    let borderClass = "border-slate-800";

                    if (item.tone === "sensational") {
                      badgeClass = "bg-rose-500/20 text-rose-300 border-rose-500/40";
                      borderClass = "border-l-4 border-rose-500 bg-rose-950/20";
                    } else if (item.tone === "speculative") {
                      badgeClass = "bg-amber-500/20 text-amber-300 border-amber-500/40";
                      borderClass = "border-l-4 border-amber-500 bg-amber-950/20";
                    } else if (item.tone === "institutional") {
                      badgeClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
                      borderClass = "border-l-4 border-emerald-500 bg-emerald-950/20";
                    }

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border text-xs text-slate-200 transition-all ${borderClass}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-mono text-slate-400">
                            Sentence #{item.id}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeClass}`}>
                            {item.tag}
                          </span>
                        </div>
                        <p className="leading-relaxed text-slate-300">"{item.text}"</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>No sensationalist keywords or speculative markers detected in this document. Text maintains objective phrasing.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. CONSENSUS & AI MODEL OUTCOME STATS */}
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
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-6 py-2 rounded-xl text-xs transition-colors cursor-pointer shadow"
          >
            Close Reader
          </button>
        </div>
      </div>
    </div>
  );
}
