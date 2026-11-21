import React from "react";
import { Link } from "react-router-dom";

const AdminOnly = (props) => {
  const handleSwitchAccount = async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
        window.location.reload();
      } catch (err) {
        console.warn('User cancelled account switch:', err);
      }
    }
  };

  return (
    <div className="container-item bg-slate-800 border-2 border-red-500 text-white p-8 rounded-xl text-center max-w-lg mx-auto mt-12 shadow-2xl">
      <div className="text-5xl mb-4">🛡️</div>
      <h2 className="text-2xl font-bold text-red-400 mb-2">
        {props.page || "Admin Access Required"}
      </h2>
      <p className="text-slate-300 text-sm mb-6 leading-relaxed">
        This page requires the <strong>Contract Administrator wallet (Account 0)</strong>. Your currently connected MetaMask wallet is identified as an <strong>Evaluator / Non-Admin account</strong>.
      </p>
      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <button
          onClick={handleSwitchAccount}
          type="button"
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors text-sm shadow cursor-pointer"
        >
          Switch to Admin Wallet in MetaMask ⇄
        </button>
        <Link
          to="/"
          className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors text-sm"
        >
          Return to Portal
        </Link>
      </div>
    </div>
  );
};

export default AdminOnly;
