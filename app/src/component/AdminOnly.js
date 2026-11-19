import React from "react";
import { Link } from "react-router-dom";

const AdminOnly = (props) => {
  return (
    <div className="container-item bg-slate-800 border-2 border-red-500 text-white p-8 rounded-xl text-center max-w-lg mx-auto mt-12 shadow-2xl">
      <div className="text-5xl mb-4">🛡️</div>
      <h2 className="text-2xl font-bold text-red-400 mb-2">
        {props.page || "Admin Access Required"}
      </h2>
      <p className="text-slate-300 text-sm mb-6 leading-relaxed">
        This page is strictly reserved for the <strong>Contract Administrator</strong> (the account that deployed the contract). Your currently connected MetaMask wallet is identified as an <strong>Evaluator / General User</strong>.
      </p>
      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <Link
          to="/"
          className="bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors text-sm"
        >
          Go to Evaluator Home
        </Link>
        <Link
          to="/Voting"
          className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors text-sm"
        >
          Verify News
        </Link>
      </div>
    </div>
  );
};

export default AdminOnly;
