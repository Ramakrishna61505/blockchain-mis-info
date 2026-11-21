// Node modules
import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheckIcon,
  ExclamationIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
} from '@heroicons/react/outline';

// Components
import Navbar from '../Navbar/Navigation';
import NavbarAdmin from '../Navbar/NavigationAdmin';
import NewsDetailModal from '../NewsDetailModal';
import ConfirmModal from '../ConfirmModal';

// Contract
import getWeb3 from '../../getWeb3';
import newsDetection from '../../contracts/newsDetection.json';
import { parseNewsPost } from '../Admin/AddNews/AddNews';

// CSS
import './Voting.css';

export default class Voting extends Component {
  constructor(props) {
    super(props);
    this.state = {
      newsDetectionInstance: undefined,
      account: null,
      web3: null,
      networkId: null,
      isAdmin: false,
      newsCount: 0,
      newss: [],
      isElStarted: false,
      isElEnded: false,
      viewingNews: null,
      currentEvaluator: {
        address: undefined,
        name: null,
        profession: null,
        hasVoted: false,
        isVerified: false,
        isRegistered: false,
      },
      votedNewsMap: {}, // Tracks per-article evaluations: { [newsId]: true }
      votingInProgress: {},
      confirmModal: null, // Configuration object for ConfirmModal
    };
  }

  componentDidMount = async () => {
    try {
      const web3 = await getWeb3();
      const accounts = await web3.eth.getAccounts();
      const networkId = await web3.eth.net.getId();
      const deployedNetwork = newsDetection.networks[networkId];
      const instance = new web3.eth.Contract(
        newsDetection.abi,
        deployedNetwork && deployedNetwork.address
      );

      this.setState({
        web3: web3,
        newsDetectionInstance: instance,
        account: accounts[0],
        networkId: networkId,
      });

      // Total number of news items
      const newsCount = await instance.methods.getTotalNews().call();
      const totalNews = parseInt(newsCount) || 0;
      this.setState({ newsCount: totalNews });

      // Start and end values
      const start = await instance.methods.getStart().call();
      const end = await instance.methods.getEnd().call();
      this.setState({ isElStarted: start, isElEnded: end });

      // Loading all published news items from smart contract
      const loadedNewss = [];
      for (let i = 0; i < totalNews; i++) {
        const news = await instance.methods.newsDetails(i).call();
        loadedNewss.push({
          id: news.newsId,
          newsPost: news.newsPost,
          voteCount: news.voteCount,
          fakeCount: news.fakeCount,
          parsed: parseNewsPost(news.newsPost),
        });
      }
      this.setState({ newss: loadedNewss });

      // Load evaluator profile for connected account
      if (accounts[0]) {
        const evaluator = await instance.methods
          .evaluatorDetails(accounts[0])
          .call();
        this.setState({
          currentEvaluator: {
            address: evaluator.evaluatorAddress,
            name: evaluator.name,
            profession: evaluator.profession,
            hasVoted: evaluator.hasVoted,
            isVerified: evaluator.isVerified,
            isRegistered: evaluator.isRegistered,
          },
        });

        // Load per-article evaluated status
        const votedNewsMap = {};
        for (let i = 0; i < totalNews; i++) {
          let hasVotedItem = false;
          try {
            if (instance.methods.hasEvaluatorVoted) {
              hasVotedItem = await instance.methods.hasEvaluatorVoted(i, accounts[0]).call();
            } else if (instance.methods.hasEvaluatedNews) {
              hasVotedItem = await instance.methods.hasEvaluatedNews(i, accounts[0]).call();
            }
          } catch (e) {
            // method not on older deployment
          }

          const localKey = `voted_${accounts[0].toLowerCase()}_${deployedNetwork ? deployedNetwork.address : ''}_${i}`;
          if (hasVotedItem || localStorage.getItem(localKey) === 'true') {
            votedNewsMap[i] = true;
          }
        }
        this.setState({ votedNewsMap });
      }

      // Check admin status
      const admin = await instance.methods.getAdmin().call();
      if (accounts[0] && admin && accounts[0].toLowerCase() === admin.toLowerCase()) {
        this.setState({ isAdmin: true });
      }
    } catch (error) {
      console.error("Error loading Voting component:", error);
      this.openAlertModal(
        "Connection Error",
        "Failed to load Web3, accounts, or contract. Please check MetaMask connection.",
        "danger"
      );
    }
  };

  openAlertModal = (title, message, type = 'info') => {
    this.setState({
      confirmModal: {
        isOpen: true,
        type: type,
        title: title,
        message: message,
        confirmText: 'Dismiss',
        isProcessing: false,
        onClose: () => this.setState({ confirmModal: null }),
        onConfirm: () => this.setState({ confirmModal: null }),
      },
    });
  };

  confirmVote = (id, headline, isFake) => {
    const { isElStarted, isElEnded, currentEvaluator, votedNewsMap } = this.state;

    if (!isElStarted || isElEnded) {
      this.openAlertModal(
        "Evaluation Round Inactive",
        "The evaluation session has not been activated yet by the administrator.",
        "warning"
      );
      return;
    }

    if (!currentEvaluator.isRegistered) {
      this.openAlertModal(
        "Registration Required",
        "Please register your evaluator profile on the Registration page before submitting evaluations.",
        "warning"
      );
      return;
    }

    if (!currentEvaluator.isVerified) {
      this.openAlertModal(
        "Pending Verification",
        "Your evaluator profile has not been approved/authenticated by the Admin yet.",
        "warning"
      );
      return;
    }

    if (votedNewsMap[id]) {
      this.openAlertModal(
        "Already Evaluated",
        `You have already submitted your evaluation for News Article #${id}. You can evaluate the other available articles!`,
        "info"
      );
      return;
    }

    const verdict = isFake ? 'FAKE' : 'AUTHENTIC';

    this.setState({
      confirmModal: {
        isOpen: true,
        type: 'confirm',
        title: isFake ? 'Flag as False / Misinformation' : 'Verify as Authentic News',
        newsId: id,
        headline: headline,
        verdict: verdict,
        message: isFake
          ? 'You are about to cast your vote flagging this news statement as FALSE or MISLEADING. This evaluation will be permanently stored on the Ethereum blockchain.'
          : 'You are about to cast your vote verifying this news statement as AUTHENTIC and CREDIBLE. This evaluation will be permanently stored on the Ethereum blockchain.',
        confirmText: isFake ? '⚠ Confirm & Flag Fake' : '✓ Confirm & Verify Authentic',
        cancelText: 'Review Again',
        isProcessing: false,
        onClose: () => this.setState({ confirmModal: null }),
        onConfirm: () => this.castVote(id, isFake),
      },
    });
  };

  castVote = async (id, isFake) => {
    const { account, newsDetectionInstance, networkId } = this.state;

    // Set modal to processing state
    this.setState((prev) => ({
      confirmModal: prev.confirmModal
        ? { ...prev.confirmModal, isProcessing: true, processingText: 'Waiting for MetaMask signature...' }
        : null,
      votingInProgress: { ...prev.votingInProgress, [id]: true },
    }));

    try {
      await newsDetectionInstance.methods
        .vote(id, isFake)
        .send({ from: account, gas: 1000000 });

      // Cache vote in localStorage immediately
      const deployedNetwork = newsDetection.networks[networkId];
      const contractAddress = deployedNetwork ? deployedNetwork.address : newsDetectionInstance._address;
      const localKey = `voted_${account.toLowerCase()}_${contractAddress}_${id}`;
      localStorage.setItem(localKey, 'true');

      // Update state
      this.setState((prev) => ({
        votedNewsMap: { ...prev.votedNewsMap, [id]: true },
        votingInProgress: { ...prev.votingInProgress, [id]: false },
      }));

      // Show success modal
      this.openAlertModal(
        "Evaluation Recorded on Chain!",
        `Your vote for Article #${id} was successfully verified and mined onto the Ethereum ledger. You may proceed to evaluate other published articles.`,
        "success"
      );
    } catch (err) {
      console.error("Voting error:", err);
      this.setState((prev) => ({
        votingInProgress: { ...prev.votingInProgress, [id]: false },
        confirmModal: null,
      }));
      this.openAlertModal(
        "Transaction Cancelled",
        err.message?.includes("User denied")
          ? "You rejected the transaction in MetaMask. No vote was recorded."
          : `Failed to record vote on blockchain: ${err.message || "Unknown error"}`,
        "warning"
      );
    }
  };

  getReputationTier = (profession, evaluatedCount) => {
    const prof = (profession || '').toLowerCase();
    if (/fact-check|journalist|editor|professor|researcher|phd|investigat|news|reporter/i.test(prof)) {
      return {
        title: 'Senior Fact-Checker',
        stars: '⭐⭐⭐',
        weight: '1.5x',
        badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      };
    }
    if (evaluatedCount >= 3 || /analyst|engineer|lawyer|doctor|academic|scientist/i.test(prof)) {
      return {
        title: 'Domain Specialist',
        stars: '⭐⭐',
        weight: '1.2x',
        badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      };
    }
    return {
      title: 'Community Evaluator',
      stars: '⭐',
      weight: '1.0x',
      badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    };
  };

  renderStatusBanner = () => {
    const { isElStarted, isElEnded, currentEvaluator, isAdmin, newss, votedNewsMap } = this.state;
    const evaluatedCount = Object.keys(votedNewsMap).filter((k) => votedNewsMap[k]).length;
    const totalCount = newss.length;

    // Case 1: Session has NOT been started by Admin yet
    if (!isElStarted && !isElEnded) {
      return (
        <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl text-amber-200 text-xs shadow-lg space-y-2 animate-fade-in">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-amber-400" />
            <strong className="text-sm text-white">Evaluation Round Not Activated Yet</strong>
          </div>
          <p className="leading-relaxed text-slate-300">
            The administrator has published news items, but the evaluation session has not been activated yet. You can inspect all published news articles below. Voting will unlock as soon as the session begins.
          </p>
          {isAdmin ? (
            <div className="pt-2">
              <Link
                to="/"
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-1.5 px-4 rounded-xl inline-block text-xs transition-colors"
              >
                Go to Admin Dashboard to Start Session &rarr;
              </Link>
            </div>
          ) : (
            !currentEvaluator.isRegistered && (
              <div className="pt-2">
                <Link
                  to="/Registration"
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-1.5 px-4 rounded-xl inline-block text-xs transition-colors"
                >
                  Register Evaluator Profile First &rarr;
                </Link>
              </div>
            )
          )}
        </div>
      );
    }

    // Case 2: Session is Active
    if (isElStarted && !isElEnded) {
      if (!currentEvaluator.isRegistered) {
        return (
          <div className="bg-sky-500/10 border border-sky-500/30 p-5 rounded-2xl text-sky-200 text-xs shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
            <div>
              <strong className="text-sm text-white block mb-0.5">Registration Required to Vote</strong>
              <span className="text-slate-300">
                You are connected as a guest. Submit your evaluator credentials so the administrator can authorize your votes.
              </span>
            </div>
            <Link
              to="/Registration"
              className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-5 rounded-xl whitespace-nowrap text-xs transition-colors"
            >
              Go to Registration &rarr;
            </Link>
          </div>
        );
      }

      if (!currentEvaluator.isVerified) {
        return (
          <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl text-amber-200 text-xs shadow-lg space-y-1 animate-fade-in">
            <strong className="text-sm text-white block">⏳ Registration Submitted — Pending Admin Verification</strong>
            <p className="text-slate-300">
              Welcome, <strong className="text-white">{currentEvaluator.name}</strong> ({currentEvaluator.profession}). Your registration was received on-chain. Waiting for the Admin to verify your credentials before signing votes.
            </p>
          </div>
        );
      }

      // Evaluator is registered and verified
      const allDone = totalCount > 0 && evaluatedCount >= totalCount;
      const rep = this.getReputationTier(currentEvaluator.profession, evaluatedCount);

      return (
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-2xl text-emerald-300 text-xs shadow-lg space-y-3 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
                Verified Evaluator: {currentEvaluator.name} ({currentEvaluator.profession})
              </span>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${rep.badgeClass}`}>
                  {rep.title} {rep.stars} ({rep.weight} Weight)
                </span>
                <span className="text-slate-300 text-xs">
                  {allDone
                    ? "You have evaluated all published articles in this round! Thank you for participating."
                    : `You can evaluate each published article individually. Cast your vote on each card below.`}
                </span>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold px-3 py-1.5 rounded-xl bg-slate-900 border border-emerald-500/30 text-emerald-300 whitespace-nowrap">
              Evaluated: {evaluatedCount} / {totalCount} Articles
            </span>
          </div>

          {/* Evaluation Progress Bar */}
          {totalCount > 0 && (
            <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-700">
              <div
                className="bg-gradient-to-r from-emerald-500 to-sky-400 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (evaluatedCount / totalCount) * 100)}%` }}
              />
            </div>
          )}
        </div>
      );
    }

    // Case 3: Session Concluded
    if (isElEnded) {
      return (
        <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl text-slate-300 text-xs shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div>
            <strong className="text-sm text-white block mb-0.5">🏁 Evaluation Round Concluded</strong>
            <span className="text-slate-400">
              Voting has ended for this round. Check the Final Outcomes page to inspect the decentralized consensus results.
            </span>
          </div>
          <Link
            to="/Final_Outcomes"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-5 rounded-xl whitespace-nowrap text-xs transition-colors"
          >
            View Final Outcomes &rarr;
          </Link>
        </div>
      );
    }

    return null;
  };

  renderNewsCard = (news) => {
    const { parsed, id } = news;
    const { isElStarted, isElEnded, currentEvaluator, votingInProgress, votedNewsMap } = this.state;
    const headline = parsed.headline;
    const hasVotedThis = Boolean(votedNewsMap[id]);

    const canVote =
      isElStarted &&
      !isElEnded &&
      currentEvaluator.isRegistered &&
      currentEvaluator.isVerified &&
      !hasVotedThis;

    let buttonLabelDisabled = "Voting Locked";
    if (!isElStarted) buttonLabelDisabled = "Round Not Started";
    else if (isElEnded) buttonLabelDisabled = "Round Concluded";
    else if (!currentEvaluator.isRegistered) buttonLabelDisabled = "Register to Vote";
    else if (!currentEvaluator.isVerified) buttonLabelDisabled = "Pending Verification";
    else if (hasVotedThis) buttonLabelDisabled = "Already Evaluated";

    const isVoting = Boolean(votingInProgress[id]);

    return (
      <div
        key={id}
        className={`glow-card bg-slate-800/90 border rounded-3xl p-6 shadow-xl space-y-4 animate-slide-up transition-all ${
          hasVotedThis
            ? 'border-emerald-500/40 bg-gradient-to-b from-slate-800 to-slate-900/90'
            : 'border-slate-700 hover:border-slate-600'
        }`}
      >
        {/* Header: ID, Source, and Evaluated Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-900 text-sky-400 font-mono">
              News ID #{id}
            </span>
            {parsed.source && (
              <span className="text-xs text-slate-400">
                Origin: <strong className="text-sky-300">{parsed.source}</strong>
              </span>
            )}
          </div>

          {hasVotedThis ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <CheckCircleIcon className="h-4 w-4" />
              Evaluated by You
            </span>
          ) : (
            <span className="text-xs text-slate-400">
              Status: <span className="text-amber-400 font-medium">Awaiting Evaluation</span>
            </span>
          )}
        </div>

        {/* Media Thumbnail (if exists) */}
        {parsed.image && (
          <div className="max-h-56 overflow-hidden rounded-2xl border border-slate-700 bg-black/40 flex items-center justify-center">
            <img
              src={parsed.image}
              alt="News article media"
              className="max-h-56 object-contain w-full transition-transform hover:scale-105 duration-300"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        )}

        {/* Headline */}
        <div>
          <h3 className="text-lg md:text-xl font-bold text-white leading-snug">
            "{headline}"
          </h3>
        </div>

        {/* Action: Open Full Content Modal */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => this.setState({ viewingNews: { id, ...parsed } })}
            className="text-xs bg-slate-900 hover:bg-slate-700 text-sky-400 hover:text-white px-4 py-2 rounded-xl border border-slate-700 font-semibold transition-all inline-flex items-center gap-2 shadow cursor-pointer"
          >
            <DocumentTextIcon className="h-4 w-4" />
            Read Full Article / Document Content &rarr;
          </button>
        </div>

        {/* Voting Action Section */}
        <div className="pt-4 border-t border-slate-700/60">
          {hasVotedThis ? (
            <div className="w-full bg-slate-900/90 border border-emerald-500/30 text-emerald-400 font-semibold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow">
              <CheckCircleIcon className="h-4 w-4" />
              <span>You have evaluated this article. Your vote is recorded on the blockchain.</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => this.confirmVote(id, headline, false)}
                  disabled={!canVote || isVoting}
                  className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700/50 disabled:text-slate-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:cursor-not-allowed hover:shadow-emerald-900/40"
                >
                  {isVoting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Signing...</span>
                    </>
                  ) : canVote ? (
                    <>
                      <ShieldCheckIcon className="h-4 w-4" />
                      <span>✓ Verify as Authentic</span>
                    </>
                  ) : (
                    buttonLabelDisabled
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => this.confirmVote(id, headline, true)}
                  disabled={!canVote || isVoting}
                  className="w-full sm:flex-1 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700/50 disabled:text-slate-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:cursor-not-allowed hover:shadow-rose-900/40"
                >
                  {isVoting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Signing...</span>
                    </>
                  ) : canVote ? (
                    <>
                      <ExclamationIcon className="h-4 w-4" />
                      <span>⚠ Flag as Fake</span>
                    </>
                  ) : (
                    buttonLabelDisabled
                  )}
                </button>
              </div>

              {canVote && (
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                  <span>Reputation Consensus Weight:</span>
                  <span className="font-semibold text-amber-300">
                    {this.getReputationTier(currentEvaluator.profession, Object.keys(votedNewsMap).length).title} ({this.getReputationTier(currentEvaluator.profession, Object.keys(votedNewsMap).length).weight})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  render() {
    if (!this.state.web3) {
      return (
        <>
          {this.state.isAdmin ? <NavbarAdmin /> : <Navbar />}
          <div className="flex items-center justify-center min-h-[60vh] text-slate-300">
            <div className="flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-sky-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Connecting to Web3 & Blockchain...</span>
            </div>
          </div>
        </>
      );
    }

    const { newss, newsCount, confirmModal } = this.state;

    return (
      <div className="md:ml-64 pt-16 md:pt-6 px-4 pb-12 min-h-screen">
        {this.state.isAdmin ? <NavbarAdmin /> : <Navbar />}

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 border border-slate-700/80 p-6 rounded-3xl shadow-xl animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 uppercase tracking-wide">
                  Evaluator Portal
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-2">
                  Verify News Authenticity
                </h1>
                <p className="text-slate-400 text-xs md:text-sm mt-1">
                  Inspect published news statements, read full source documents, and submit your immutable evaluation vote to the blockchain.
                </p>
              </div>
              <span className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300">
                Published News: {newsCount}
              </span>
            </div>
          </div>

          {/* Dynamic Status Banner */}
          {this.renderStatusBanner()}

          {/* Published News List - Always Visible */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Published News for Evaluation ({newss.length})
            </h2>

            {newss.length === 0 ? (
              <div className="bg-slate-800 border border-slate-700 p-8 rounded-3xl text-center text-slate-400 animate-fade-in">
                No news items published on this contract yet. The administrator has not added any news articles.
              </div>
            ) : (
              <div className="space-y-5">
                {newss.map(this.renderNewsCard)}
              </div>
            )}
          </div>
        </div>

        {/* News Detail Reader Modal */}
        <NewsDetailModal
          isOpen={Boolean(this.state.viewingNews)}
          news={this.state.viewingNews}
          onClose={() => this.setState({ viewingNews: null })}
        />

        {/* Professional Custom Confirmation & Alert Modal */}
        {confirmModal && (
          <ConfirmModal
            isOpen={confirmModal.isOpen}
            type={confirmModal.type}
            title={confirmModal.title}
            message={confirmModal.message}
            headline={confirmModal.headline}
            newsId={confirmModal.newsId}
            verdict={confirmModal.verdict}
            confirmText={confirmModal.confirmText}
            cancelText={confirmModal.cancelText}
            isProcessing={confirmModal.isProcessing}
            processingText={confirmModal.processingText}
            onClose={confirmModal.onClose || (() => this.setState({ confirmModal: null }))}
            onConfirm={confirmModal.onConfirm}
          />
        )}
      </div>
    );
  }
}
