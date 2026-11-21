import React, { Component } from 'react';
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  BanIcon,
  UserGroupIcon,
  SearchIcon,
  ClockIcon,
} from '@heroicons/react/outline';

import Navbar from '../../Navbar/Navigation';
import NavbarAdmin from '../../Navbar/NavigationAdmin';
import AdminOnly from '../../AdminOnly';
import ConfirmModal from '../../ConfirmModal';

import getWeb3 from '../../../getWeb3';
import newsDetection from '../../../contracts/newsDetection.json';

import './Verification.css';

export default class Verification extends Component {
  constructor(props) {
    super(props);
    this.state = {
      newsDetectionInstance: undefined,
      account: null,
      web3: null,
      isAdmin: false,
      evaluatorCount: 0,
      evaluators: [],
      isLoading: true,
      searchQuery: '',
      activeFilter: 'all', // 'all' | 'verified' | 'unverified'
      confirmModal: null,
    };
  }

  componentDidMount = async () => {
    await this.initBlockchain();
  };

  initBlockchain = async () => {
    try {
      const web3 = await getWeb3();
      const accounts = await web3.eth.getAccounts();
      const currentAccount =
        (accounts && accounts[0]) ||
        (window.ethereum && window.ethereum.selectedAddress) ||
        null;

      const networkId = await web3.eth.net.getId();
      const deployedNetwork =
        newsDetection.networks[networkId] ||
        newsDetection.networks['1337'] ||
        newsDetection.networks['5777'];

      if (!deployedNetwork || !deployedNetwork.address) {
        throw new Error(`Contract not deployed on network ${networkId}`);
      }

      const instance = new web3.eth.Contract(
        newsDetection.abi,
        deployedNetwork.address
      );

      const admin = await instance.methods.getAdmin().call();
      const isAdmin = Boolean(
        currentAccount &&
          admin &&
          currentAccount.toLowerCase() === admin.toLowerCase()
      );

      this.setState(
        {
          web3,
          newsDetectionInstance: instance,
          account: currentAccount,
          isAdmin,
        },
        async () => {
          await this.loadEvaluators();
        }
      );
    } catch (error) {
      console.error('Verification component load error:', error);
      this.setState({ isLoading: false });
    }
  };

  loadEvaluators = async () => {
    const { newsDetectionInstance } = this.state;
    if (!newsDetectionInstance) return;

    try {
      this.setState({ isLoading: true });
      const rawCount = await newsDetectionInstance.methods
        .getTotalEvaluator()
        .call();
      const count = parseInt(rawCount, 10) || 0;

      const loaded = [];
      for (let i = 0; i < count; i++) {
        const evaluatorAddress = await newsDetectionInstance.methods
          .evaluators(i)
          .call();
        const details = await newsDetectionInstance.methods
          .evaluatorDetails(evaluatorAddress)
          .call();

        loaded.push({
          address: details.evaluatorAddress || evaluatorAddress,
          name: details.name || 'Anonymous Evaluator',
          profession: details.profession || 'Community Member',
          idn: details.idn || 'N/A',
          hasVoted: Boolean(details.hasVoted),
          isVerified: Boolean(details.isVerified),
          isRegistered: Boolean(details.isRegistered),
        });
      }

      this.setState({
        evaluatorCount: count,
        evaluators: loaded,
        isLoading: false,
      });
    } catch (err) {
      console.error('Failed to load evaluators list:', err);
      this.setState({ isLoading: false });
    }
  };

  promptVerifyEvaluator = (evaluator, newStatus) => {
    const isApprove = newStatus === true;

    this.setState({
      confirmModal: {
        isOpen: true,
        type: isApprove ? 'confirm' : 'danger',
        title: isApprove
          ? 'Approve Evaluator Verification'
          : 'Revoke Verification & Ban Evaluator',
        message: isApprove
          ? `Authorize "${evaluator.name}" (${evaluator.profession}, ID: ${evaluator.idn}) to evaluate news? Their on-chain status will be set to Verified and they can vote in consensus rounds.`
          : `Are you sure you want to restrict / ban "${evaluator.name}" (${evaluator.profession})? This on-chain action will immediately revoke their voting permissions and restrict their Evaluator Portal access for platform violations.`,
        confirmText: isApprove ? 'Approve Evaluator on Chain' : 'Confirm Ban & Revoke Access',
        cancelText: 'Cancel',
        isProcessing: false,
        onClose: () => this.setState({ confirmModal: null }),
        onConfirm: () => this.executeVerifyEvaluator(newStatus, evaluator.address),
      },
    });
  };

  executeVerifyEvaluator = async (status, address) => {
    this.setState((prev) => ({
      confirmModal: prev.confirmModal
        ? {
            ...prev.confirmModal,
            isProcessing: true,
            processingText: status
              ? 'Signing approval transaction on MetaMask...'
              : 'Signing revocation/ban transaction on MetaMask...',
          }
        : null,
    }));

    try {
      await this.state.newsDetectionInstance.methods
        .verifyEvaluator(status, address)
        .send({ from: this.state.account, gas: 1000000 });

      this.setState({ confirmModal: null });
      await this.loadEvaluators();
    } catch (err) {
      console.error('Failed to update verification status on blockchain:', err);
      this.setState({
        confirmModal: {
          isOpen: true,
          type: 'warning',
          title: 'Transaction Cancelled or Failed',
          message: err.message?.includes('User denied')
            ? 'Transaction was rejected in MetaMask.'
            : `Failed to update evaluator status: ${err.message || 'Unknown error'}`,
          confirmText: 'Dismiss',
          onClose: () => this.setState({ confirmModal: null }),
          onConfirm: () => this.setState({ confirmModal: null }),
        },
      });
    }
  };

  render() {
    const {
      web3,
      isAdmin,
      isLoading,
      evaluators,
      searchQuery,
      activeFilter,
      confirmModal,
    } = this.state;

    if (!web3) {
      return (
        <>
          {isAdmin ? <NavbarAdmin /> : <Navbar />}
          <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
            <div className="text-center p-6 bg-slate-900 rounded-2xl border border-slate-800">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mx-auto mb-3" />
              <p className="text-slate-300 text-sm">Connecting to Web3 & Smart Contract...</p>
            </div>
          </div>
        </>
      );
    }

    if (!isAdmin) {
      return (
        <>
          <Navbar />
          <AdminOnly page="Evaluator Governance & Verification" />
        </>
      );
    }

    // Filter evaluators
    const filteredEvaluators = evaluators.filter((e) => {
      const matchesSearch =
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.profession.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.idn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.address.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeFilter === 'verified') return e.isVerified;
      if (activeFilter === 'unverified') return !e.isVerified;
      return true;
    });

    const verifiedCount = evaluators.filter((e) => e.isVerified).length;
    const unverifiedCount = evaluators.filter((e) => !e.isVerified).length;

    return (
      <div className="md:ml-64 pt-16 md:pt-6 px-4 pb-16 min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white animate-fade-in">
        <NavbarAdmin />

        <div className="w-full max-w-5xl mx-auto space-y-6">
          {/* Header Card */}
          <div className="bg-slate-900/80 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 backdrop-blur">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                <ShieldCheckIcon className="h-4 w-4" />
                Administrative Governance
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                Evaluator Authentication & Access Control
              </h1>
              <p className="text-slate-400 text-xs md:text-sm max-w-2xl leading-relaxed">
                Review credential applications, grant voting permissions to verified journalists and researchers, and restrict or ban accounts for guideline violations.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="bg-slate-950/90 border border-slate-800 px-4 py-3 rounded-2xl text-center min-w-[90px]">
                <span className="text-xl font-black text-white">{evaluators.length}</span>
                <span className="block text-[10px] text-slate-400 uppercase font-semibold mt-0.5">Total</span>
              </div>
              <div className="bg-emerald-950/40 border border-emerald-800/50 px-4 py-3 rounded-2xl text-center min-w-[90px]">
                <span className="text-xl font-black text-emerald-400">{verifiedCount}</span>
                <span className="block text-[10px] text-emerald-300 uppercase font-semibold mt-0.5">Approved</span>
              </div>
              <div className="bg-amber-950/40 border border-amber-800/50 px-4 py-3 rounded-2xl text-center min-w-[90px]">
                <span className="text-xl font-black text-amber-400">{unverifiedCount}</span>
                <span className="block text-[10px] text-amber-300 uppercase font-semibold mt-0.5">Restricted</span>
              </div>
            </div>
          </div>

          {/* Guideline Banner */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-300">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span>
                <strong>Verification Standard:</strong> Only accredited journalists, investigative reporters, or verified subject experts should hold active evaluation status.
              </span>
            </div>
            <button
              onClick={this.loadEvaluators}
              disabled={isLoading}
              type="button"
              className="text-xs bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-white px-3 py-1.5 rounded-xl border border-slate-700 transition-colors font-medium flex-shrink-0 self-start sm:self-auto"
            >
              Refresh on Chain ↻
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex p-1 bg-slate-900/90 rounded-2xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => this.setState({ activeFilter: 'all' })}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                  activeFilter === 'all'
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({evaluators.length})
              </button>
              <button
                type="button"
                onClick={() => this.setState({ activeFilter: 'verified' })}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
                  activeFilter === 'verified'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-400" />
                Approved ({verifiedCount})
              </button>
              <button
                type="button"
                onClick={() => this.setState({ activeFilter: 'unverified' })}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
                  activeFilter === 'unverified'
                    ? 'bg-rose-950 text-rose-300 border border-rose-700/60 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BanIcon className="h-3.5 w-3.5 text-rose-400" />
                Restricted / Pending ({unverifiedCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <SearchIcon className="h-4 w-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => this.setState({ searchQuery: e.target.value })}
                placeholder="Search name, ID, role, or wallet..."
                className="w-full bg-slate-900/90 border border-slate-800 focus:border-sky-500 text-white rounded-2xl pl-9 pr-3.5 py-2 text-xs focus:outline-none transition-colors shadow-inner"
              />
            </div>
          </div>

          {/* Evaluator List Cards */}
          {isLoading ? (
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mx-auto mb-3" />
              <p className="text-xs">Synchronizing evaluator registry from Ethereum contract...</p>
            </div>
          ) : filteredEvaluators.length === 0 ? (
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <UserGroupIcon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">No Evaluators Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery
                  ? `No accounts matched your search "${searchQuery}".`
                  : 'No users have registered with this criteria yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredEvaluators.map((evaluator) => {
                const isVerified = evaluator.isVerified;

                return (
                  <div
                    key={evaluator.address}
                    className={`bg-slate-900/80 border rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-lg ${
                      isVerified
                        ? 'border-emerald-500/30 hover:border-emerald-500/60'
                        : 'border-amber-500/30 hover:border-amber-500/60'
                    }`}
                  >
                    {/* Left: Evaluator Details */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-white tracking-tight">
                          {evaluator.name}
                        </h3>
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700">
                          {evaluator.profession}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                          ID: {evaluator.idn}
                        </span>
                      </div>

                      {/* Ethereum Wallet Address & Voting Activity */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5 font-mono text-slate-300">
                          <span className="text-slate-500">Wallet:</span>
                          <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px] text-sky-400">
                            {evaluator.address}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {evaluator.hasVoted ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                              <CheckCircleIcon className="h-3.5 w-3.5" /> Participated in Voting
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                              <ClockIcon className="h-3.5 w-3.5" /> No votes submitted yet
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Status Badge & Action Controls */}
                    <div className="flex items-center gap-3 flex-shrink-0 self-end md:self-center">
                      {/* Status Tag */}
                      {isVerified ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-600/60">
                          <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
                          Approved & Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-600/60">
                          <ClockIcon className="h-4 w-4 text-amber-400" />
                          Restricted / Pending
                        </span>
                      )}

                      {/* Action Button: Ban vs Approve */}
                      {isVerified ? (
                        <button
                          type="button"
                          onClick={() => this.promptVerifyEvaluator(evaluator, false)}
                          className="bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 font-semibold py-1.5 px-3.5 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <BanIcon className="h-3.5 w-3.5" />
                          <span>Revoke / Ban Access</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => this.promptVerifyEvaluator(evaluator, true)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3.5 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 cursor-pointer"
                        >
                          <CheckCircleIcon className="h-3.5 w-3.5" />
                          <span>Approve Evaluator</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Global Interactive Modal */}
        {confirmModal && (
          <ConfirmModal
            isOpen={confirmModal.isOpen}
            type={confirmModal.type}
            title={confirmModal.title}
            message={confirmModal.message}
            confirmText={confirmModal.confirmText}
            cancelText={confirmModal.cancelText}
            isProcessing={confirmModal.isProcessing}
            processingText={confirmModal.processingText}
            onClose={confirmModal.onClose || (() => this.setState({ confirmModal: null }))}
            onConfirm={confirmModal.onConfirm || (() => this.setState({ confirmModal: null }))}
          />
        )}
      </div>
    );
  }
}
