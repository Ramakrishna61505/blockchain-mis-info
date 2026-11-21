import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheckIcon,
  SearchIcon,
  KeyIcon,
  EyeIcon,
  EyeOffIcon,
} from '@heroicons/react/outline';

import getWeb3 from '../../getWeb3';
import newsDetection from '../../contracts/newsDetection.json';
import ConfirmModal from '../ConfirmModal';

const ADMIN_MASTER_PASSCODE = 'admin123';

export default function PortalLogin({ onLoginSuccess }) {
  const [account, setAccount] = useState('');
  const [adminAddress, setAdminAddress] = useState('');
  const [contractInstance, setContractInstance] = useState(null);
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [isLoggingInAdmin, setIsLoggingInAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Evaluator Mode: 'signin' | 'register'
  const [evaluatorMode, setEvaluatorMode] = useState('signin');

  // Sign-in fields
  const [evalUsername, setEvalUsername] = useState('evaluator@factverify.org');
  const [evalPassword, setEvalPassword] = useState('eval123');
  const [showEvalPassword, setShowEvalPassword] = useState(false);
  const [evalError, setEvalError] = useState('');

  // Registration fields
  const [regName, setRegName] = useState('');
  const [regProfession, setRegProfession] = useState('Investigative Journalist');
  const [regIdn, setRegIdn] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  // Modal alert
  const [alertModal, setAlertModal] = useState(null);

  const checkEvaluatorStatus = useCallback(async (currentAccount, instance) => {
    if (!currentAccount || !instance) return null;
    try {
      const details = await instance.methods.evaluatorDetails(currentAccount).call();
      if (details.isRegistered && details.name) {
        setEvalUsername(details.name.toLowerCase().replace(/\s+/g, '.') + '@factverify.org');
      }
      return {
        isRegistered: Boolean(details.isRegistered),
        isVerified: Boolean(details.isVerified),
        name: details.name,
        profession: details.profession,
        idn: details.idn,
      };
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const web3 = await getWeb3();
        let accounts = await web3.eth.getAccounts();
        if ((!accounts || accounts.length === 0) && window.ethereum) {
          try {
            accounts = await window.ethereum.request({ method: 'eth_accounts' });
          } catch {
            // ignore
          }
        }

        const currentAccount =
          (accounts && accounts[0]) ||
          (window.ethereum && window.ethereum.selectedAddress) ||
          '';

        if (isMounted) {
          setAccount(currentAccount);
        }

        const networkId = await web3.eth.net.getId();
        const deployedNetwork =
          newsDetection.networks[networkId] ||
          newsDetection.networks['1337'] ||
          newsDetection.networks['5777'];

        if (deployedNetwork && deployedNetwork.address) {
          const instance = new web3.eth.Contract(
            newsDetection.abi,
            deployedNetwork.address
          );
          if (isMounted) {
            setContractInstance(instance);
          }

          const admin = await instance.methods.getAdmin().call();
          if (isMounted) {
            setAdminAddress(admin);
          }

          if (currentAccount && isMounted) {
            await checkEvaluatorStatus(currentAccount, instance);
          }
        }
      } catch (err) {
        console.error('Login initialization error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    init();

    const handleAccountChange = () => {
      init();
    };

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountChange);
    }

    return () => {
      isMounted = false;
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountChange);
      }
    };
  }, [checkEvaluatorStatus]);

  // Handle Admin Login (Passcode first, wallet connect popup triggered after login)
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAdminError('');

    if (passcode !== ADMIN_MASTER_PASSCODE) {
      setAdminError('Invalid Admin Master Passcode. (Default: admin123)');
      return;
    }

    setIsLoggingInAdmin(true);

    // Save admin portal session
    sessionStorage.setItem('portalRole', 'admin');
    localStorage.setItem('preferredPortal', 'admin');

    // Trigger MetaMask wallet connect popup after successful passcode login
    if (window.ethereum) {
      try {
        const currentAccounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (!currentAccounts || currentAccounts.length === 0) {
          // Triggers MetaMask Connect popup
          await window.ethereum.request({ method: 'eth_requestAccounts' });
        } else if (adminAddress && currentAccounts[0].toLowerCase() !== adminAddress.toLowerCase()) {
          // Prompt account selection if current wallet is not the deployer account
          try {
            await window.ethereum.request({
              method: 'wallet_requestPermissions',
              params: [{ eth_accounts: {} }],
            });
          } catch {
            // User may dismiss account switch modal
          }
        }
      } catch (err) {
        console.warn('MetaMask wallet connect prompt dismissed or pending:', err);
      }
    }

    setIsLoggingInAdmin(false);

    if (onLoginSuccess) {
      onLoginSuccess('admin');
    } else {
      window.location.reload();
    }
  };

  // Handle Evaluator Sign In
  const handleEvaluatorLogin = async (e) => {
    e.preventDefault();
    setEvalError('');

    if (!account) {
      setEvalError('Please connect your MetaMask wallet first.');
      return;
    }

    if (!evalUsername.trim()) {
      setEvalError('Please enter your evaluator username or email.');
      return;
    }

    if (!evalPassword) {
      setEvalError('Please enter your evaluator password.');
      return;
    }

    if (!contractInstance) {
      setEvalError('Blockchain contract is not connected.');
      return;
    }

    try {
      const details = await contractInstance.methods.evaluatorDetails(account).call();

      // Case 1: Unregistered wallet
      if (!details.isRegistered) {
        setAlertModal({
          isOpen: true,
          type: 'info',
          title: 'Unregistered Wallet Profile',
          message: `The connected wallet (${account.substring(
            0,
            8
          )}...) has not registered as an Evaluator yet. Please click "Register as New Evaluator" to submit your application.`,
          confirmText: 'Go to Registration',
          onClose: () => setAlertModal(null),
          onConfirm: () => {
            setAlertModal(null);
            setEvaluatorMode('register');
          },
        });
        return;
      }

      // Case 2: Registered on-chain, but pending Admin verification
      if (!details.isVerified) {
        setAlertModal({
          isOpen: true,
          type: 'warning',
          title: '⏳ Awaiting Approval from Administrator',
          message: `Your registration for "${details.name}" (${details.profession}) has been successfully submitted on the Ethereum blockchain, but is currently awaiting Administrator authentication.\n\nThe Admin must approve your credentials from the Admin Portal before you can access the Evaluator Workspace.`,
          confirmText: 'Understood',
          onClose: () => setAlertModal(null),
          onConfirm: () => setAlertModal(null),
        });
        return;
      }

      // Case 3: Registered AND Verified by Admin -> Access Granted!
      sessionStorage.setItem('portalRole', 'evaluator');
      sessionStorage.setItem('evaluatorUser', evalUsername.trim());
      localStorage.setItem('preferredPortal', 'evaluator');

      if (onLoginSuccess) {
        onLoginSuccess('evaluator');
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error('Login status check failed:', err);
      setEvalError('Failed to verify status on blockchain: ' + (err.message || 'Unknown error'));
    }
  };

  // Handle New Evaluator Registration Submission
  const handleRegisterEvaluator = async (e) => {
    e.preventDefault();
    setEvalError('');

    if (!account) {
      setEvalError('Please connect your MetaMask wallet first.');
      return;
    }

    if (!regName.trim() || !regIdn.trim() || !regProfession.trim() || !regPassword) {
      setEvalError('Please fill in all registration fields.');
      return;
    }

    if (!contractInstance) {
      setEvalError('Contract is not connected.');
      return;
    }

    setIsSubmittingReg(true);
    try {
      // Send transaction to smart contract
      await contractInstance.methods
        .registerAsEvaluator(regName.trim(), regIdn.trim(), regProfession.trim())
        .send({ from: account, gas: 1000000 });

      // Cache credentials locally
      localStorage.setItem(`eval_pwd_${account.toLowerCase()}`, regPassword);
      sessionStorage.setItem('evaluatorUser', regName.trim());

      await checkEvaluatorStatus(account, contractInstance);
      setIsSubmittingReg(false);
      setEvaluatorMode('signin');

      // Throw the requested confirmation popup: Awaiting approval from Admin!
      setAlertModal({
        isOpen: true,
        type: 'warning',
        title: '⏳ Registration Submitted — Awaiting Admin Approval',
        message: `Your registration request for "${regName.trim()}" (${regProfession.trim()}) was successfully recorded on the Ethereum blockchain!\n\nA request has been sent to the Administrator. The Admin must approve your profile from the Admin Portal ("Authenticate Evaluators") before your account can access the Evaluator Workspace.`,
        confirmText: 'Understood',
        onClose: () => setAlertModal(null),
        onConfirm: () => setAlertModal(null),
      });
    } catch (err) {
      console.error('Registration failed:', err);
      setIsSubmittingReg(false);
      setEvalError(
        err.message?.includes('User denied')
          ? 'Transaction was rejected in MetaMask.'
          : `Failed to record registration on blockchain: ${err.message || 'Unknown error'}`
      );
    }
  };

  const handleSwitchAccountPrompt = async () => {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col justify-center items-center px-4 py-12 animate-fade-in">
      <div className="w-full max-w-5xl space-y-8">
        {/* Top Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            Decentralized Misinformation Detection Protocol
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white font-sans">
            FactVerify Authentication Gateway
          </h1>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Choose your designated portal. Administrator governance and Evaluator consensus workflows are strictly isolated.
          </p>
        </div>

        {/* Connected Wallet Bar */}
        <div className="max-w-2xl mx-auto bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400">Connected Wallet:</span>
            <span className="font-mono text-emerald-300 font-bold">
              {account
                ? `${account.substring(0, 10)}...${account.substring(account.length - 6)}`
                : 'Connecting to MetaMask...'}
            </span>
          </div>
          <button
            onClick={handleSwitchAccountPrompt}
            type="button"
            className="text-xs bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white px-3 py-1.5 rounded-xl border border-slate-700 transition-colors cursor-pointer font-medium"
          >
            Switch Account ⇄
          </button>
        </div>

        {/* Dual Portal Gateway Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch">
          {/* Card 1: Administrator Portal */}
          <div className="bg-slate-900/80 border border-emerald-500/30 hover:border-emerald-500/60 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative transition-all duration-200">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shadow">
                  <ShieldCheckIcon className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-800/60 uppercase tracking-wider">
                  Admin
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Administrator Portal</h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Manage evaluation rounds, publish news items, and authenticate evaluator accounts.
                </p>
              </div>

              {/* Passcode Form */}
              <form onSubmit={handleAdminLogin} className="space-y-4 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Master Passcode
                    </label>
                    <span className="text-[10px] text-slate-500">Default: admin123</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="Enter admin passcode"
                      autoComplete="current-password"
                      style={{
                        color: '#ffffff',
                        backgroundColor: '#020617',
                        caretColor: '#10b981',
                        fontSize: '14px',
                        letterSpacing: showPassword ? 'normal' : '2px',
                        fontWeight: '600',
                        fontFamily: 'monospace, sans-serif',
                      }}
                      className="w-full bg-slate-950/90 border border-slate-800 focus:border-emerald-500 text-white rounded-xl px-3.5 py-2.5 focus:outline-none transition-colors pr-10 shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs p-1"
                    >
                      {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {adminError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                    {adminError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoggingInAdmin}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer"
                >
                  {isLoggingInAdmin ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Connecting Wallet...</span>
                    </>
                  ) : (
                    <>
                      <KeyIcon className="h-4 w-4" />
                      <span>Authenticate as Administrator &rarr;</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="pt-6 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Smart Contract Governance</span>
              <span className="text-emerald-400 font-mono">Ganache Core</span>
            </div>
          </div>

          {/* Card 2: Evaluator Portal */}
          <div className="bg-slate-900/80 border border-sky-500/30 hover:border-sky-500/60 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-11 w-11 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shadow">
                  <SearchIcon className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-sky-950/90 text-sky-300 border border-sky-800/60 uppercase tracking-wider">
                  Evaluator
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Evaluator Portal</h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Participate in decentralized consensus and submit fact-checking verdicts.
                </p>
              </div>

              {/* Minimal Segmented Tabs */}
              <div className="flex p-1 bg-slate-950/90 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setEvaluatorMode('signin');
                    setEvalError('');
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${evaluatorMode === 'signin'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEvaluatorMode('register');
                    setEvalError('');
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${evaluatorMode === 'register'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Register
                </button>
              </div>

              {evalError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {evalError}
                </div>
              )}

              {/* TAB 1: Evaluator Sign-In */}
              {evaluatorMode === 'signin' ? (
                <form onSubmit={handleEvaluatorLogin} className="space-y-3.5 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Username or Email
                    </label>
                    <input
                      type="text"
                      value={evalUsername}
                      onChange={(e) => setEvalUsername(e.target.value)}
                      placeholder="e.g. evaluator@factverify.org"
                      style={{
                        color: '#ffffff',
                        backgroundColor: '#020617',
                        fontSize: '13px',
                      }}
                      className="w-full bg-slate-950/90 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-colors shadow-inner"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-slate-300">
                        Password
                      </label>
                      <span className="text-[10px] text-slate-500">Default: eval123</span>
                    </div>
                    <div className="relative">
                      <input
                        type={showEvalPassword ? 'text' : 'password'}
                        value={evalPassword}
                        onChange={(e) => setEvalPassword(e.target.value)}
                        placeholder="Enter password"
                        autoComplete="current-password"
                        style={{
                          color: '#ffffff',
                          backgroundColor: '#020617',
                          caretColor: '#38bdf8',
                          fontSize: '14px',
                          letterSpacing: showEvalPassword ? 'normal' : '2px',
                          fontWeight: '600',
                          fontFamily: 'monospace, sans-serif',
                        }}
                        className="w-full bg-slate-950/90 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3.5 py-2.5 focus:outline-none transition-colors pr-10 shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEvalPassword(!showEvalPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs p-1"
                      >
                        {showEvalPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-950/40 cursor-pointer pt-2"
                  >
                    <SearchIcon className="h-4 w-4" />
                    <span>Enter Evaluator Workspace &rarr;</span>
                  </button>

                  <p className="text-center text-[11px] text-slate-500 pt-1">
                    Don't have an approved account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setEvaluatorMode('register');
                        setEvalError('');
                      }}
                      className="text-sky-400 hover:underline font-medium"
                    >
                      Register here
                    </button>
                  </p>
                </form>
              ) : (
                /* TAB 2: Clean Evaluator Registration Form */
                <form onSubmit={handleRegisterEvaluator} className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="e.g. Sarah Jenkins"
                        required
                        style={{ color: '#ffffff', backgroundColor: '#020617', fontSize: '12px' }}
                        className="w-full bg-slate-950/90 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3 py-2 text-xs focus:outline-none shadow-inner"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Profession / Role *
                      </label>
                      <input
                        type="text"
                        value={regProfession}
                        onChange={(e) => setRegProfession(e.target.value)}
                        placeholder="e.g. Senior Fact-Checker"
                        required
                        style={{ color: '#ffffff', backgroundColor: '#020617', fontSize: '12px' }}
                        className="w-full bg-slate-950/90 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3 py-2 text-xs focus:outline-none shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Press or National ID *
                      </label>
                      <input
                        type="text"
                        value={regIdn}
                        onChange={(e) => setRegIdn(e.target.value)}
                        placeholder="e.g. PRS-99201"
                        required
                        style={{ color: '#ffffff', backgroundColor: '#020617', fontSize: '12px' }}
                        className="w-full bg-slate-950/90 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3 py-2 text-xs focus:outline-none shadow-inner"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Account Password *
                      </label>
                      <div className="relative">
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="Password"
                          required
                          autoComplete="new-password"
                          style={{
                            color: '#ffffff',
                            backgroundColor: '#020617',
                            caretColor: '#38bdf8',
                            fontSize: '12px',
                            letterSpacing: showRegPassword ? 'normal' : '2px',
                            fontFamily: 'monospace, sans-serif',
                          }}
                          className="w-full bg-slate-950/90 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3 py-2 focus:outline-none pr-8 text-xs shadow-inner"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute right-2 top-2 text-slate-400 hover:text-white text-xs"
                        >
                          {showRegPassword ? <EyeOffIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingReg || isLoading}
                    className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-950/40 cursor-pointer mt-1"
                  >
                    {isSubmittingReg ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Submitting to Blockchain...</span>
                      </>
                    ) : (
                      <span>Submit Registration Request &rarr;</span>
                    )}
                  </button>

                  <p className="text-center text-[10px] text-slate-500 leading-tight">
                    Registrations are recorded on-chain and reviewed by the Admin before access is unlocked.
                  </p>
                </form>
              )}
            </div>

            <div className="pt-6 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Decentralized Consensus</span>
              <span className="text-sky-400 font-mono">Consensus Node</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500 pt-4">
          FactVerify Consensus Core • Dual-layer Blockchain + AI Framework
        </div>
      </div>

      {/* Global Interactive Alert Modal */}
      {alertModal && (
        <ConfirmModal
          isOpen={alertModal.isOpen}
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          confirmText={alertModal.confirmText}
          cancelText={alertModal.cancelText}
          onClose={alertModal.onClose || (() => setAlertModal(null))}
          onConfirm={alertModal.onConfirm || (() => setAlertModal(null))}
        />
      )}
    </div>
  );
}
