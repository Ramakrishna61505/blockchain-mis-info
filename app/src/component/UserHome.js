import React from "react";
import { Link } from "react-router-dom";
import {
  UserAddIcon,
  ShieldCheckIcon,
  ChartSquareBarIcon,
  InformationCircleIcon,
} from "@heroicons/react/outline";

function UserHome(props) {
  const el = props.el || {};

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Session Title Header */}
      <div className="bg-gradient-to-r from-sky-900 to-slate-900 border border-sky-700/50 p-6 rounded-2xl shadow-xl">
        <span className="text-xs font-semibold px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 uppercase tracking-wide">
          Active Evaluation Session
        </span>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-2 capitalize">
          {el.newsdetectionTitle || "News Authenticity Evaluation Round"}
        </h1>
        <p className="text-slate-300 text-sm mt-1">
          Organized by: <strong className="text-white capitalize">{el.adminName || "News Publisher"}</strong> ({el.adminEmail || "admin"})
        </p>
      </div>

      {/* Evaluator Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Step 1: Registration */}
        <div className="bg-slate-800/90 border border-slate-700 p-6 rounded-2xl flex flex-col justify-between hover:border-sky-500 transition-all shadow-lg">
          <div>
            <div className="h-12 w-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-4">
              <UserAddIcon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">1. Evaluator Registration</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Register your evaluator credentials (Name, Profession, ID) on-chain so the Admin can authenticate your profile.
            </p>
          </div>
          <Link
            to="/Registration"
            className="mt-5 w-full bg-sky-600 hover:bg-sky-500 text-white font-medium py-2 px-4 rounded-lg text-sm text-center block transition-colors"
          >
            Go to Registration &rarr;
          </Link>
        </div>

        {/* Step 2: Voting */}
        <div className="bg-slate-800/90 border border-slate-700 p-6 rounded-2xl flex flex-col justify-between hover:border-sky-500 transition-all shadow-lg">
          <div>
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
              <ShieldCheckIcon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">2. Verify News</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Once verified by the administrator, analyze published news posts and cast your vote as <strong>Authentic</strong> or <strong>Fake</strong>.
            </p>
          </div>
          <Link
            to="/Voting"
            className="mt-5 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 px-4 rounded-lg text-sm text-center block transition-colors"
          >
            Start Evaluating &rarr;
          </Link>
        </div>

        {/* Step 3: Outcomes */}
        <div className="bg-slate-800/90 border border-slate-700 p-6 rounded-2xl flex flex-col justify-between hover:border-sky-500 transition-all shadow-lg">
          <div>
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4">
              <ChartSquareBarIcon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">3. Public Outcomes</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Inspect current community verification scores, authenticity percentage ratings, and consensus stored on the blockchain.
            </p>
          </div>
          <Link
            to="/Outcomes"
            className="mt-5 w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-2 px-4 rounded-lg text-sm text-center block transition-colors"
          >
            View Consensus &rarr;
          </Link>
        </div>
      </div>

      {/* Guidelines Box */}
      <div className="bg-slate-800/50 border border-slate-700/60 p-5 rounded-xl flex items-start gap-3">
        <InformationCircleIcon className="h-6 w-6 text-sky-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-white">How verification works:</strong> Evaluator opinions are recorded in an immutable smart contract. These evaluations are synthesized with continuous Natural Language Processing (NLP) deep learning models to produce an objective, tamper-proof authenticity verdict.
        </div>
      </div>
    </div>
  );
}

export default UserHome;
