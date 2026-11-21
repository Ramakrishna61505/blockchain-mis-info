// Node modules
import React, { Component } from 'react';
import { Link } from 'react-router-dom';

// Components
import Navbar from '../Navbar/Navigation';
import NavbarAdmin from '../Navbar/NavigationAdmin';
import NotInit from '../NotInit';
import NewsDetailModal from '../NewsDetailModal';
import ConfirmModal from '../ConfirmModal';
import VerificationCertificateModal from '../VerificationCertificateModal';

// Contract
import getWeb3 from '../../getWeb3';
import newsDetection from '../../contracts/newsDetection.json';
import { parseNewsPost } from '../Admin/AddNews/AddNews';

// CSS
import './Final_Outcomes.css';

const NLP_API_URL = 'http://127.0.0.1:5000';

export default class Result extends Component {
  constructor(props) {
    super(props);
    this.state = {
      newsDetectionInstance: undefined,
      account: null,
      web3: null,
      networkId: null,
      isAdmin: false,
      newsCount: undefined,
      newss: [],
      isElStarted: false,
      isElEnded: false,
      nlpPredictions: {},
      nlpServiceOnline: false,
      syncedFeedback: {},
      syncLoading: {},
      viewingNews: null,
      activeCertificate: null,
      viewMode: 'cards', // 'cards' | 'analytics'
      alertModal: null,
    };
  }

  openAlert = (title, message, type = 'info') => {
    this.setState({
      alertModal: {
        isOpen: true,
        type: type,
        title: title,
        message: message,
        confirmText: 'Dismiss',
        isProcessing: false,
        onClose: () => this.setState({ alertModal: null }),
        onConfirm: () => this.setState({ alertModal: null }),
      },
    });
  };

  componentDidMount = async () => {
    try {
      // Check NLP Service Health
      this.checkNlpHealth();

      // Get network provider and web3 instance.
      const web3 = await getWeb3();

      // Use web3 to get the user's accounts.
      const accounts = await web3.eth.getAccounts();

      // Get the contract instance.
      const networkId = await web3.eth.net.getId();
      const deployedNetwork = newsDetection.networks[networkId];
      const instance = new web3.eth.Contract(
        newsDetection.abi,
        deployedNetwork && deployedNetwork.address
      );

      this.setState({
        web3,
        networkId,
        newsDetectionInstance: instance,
        account: accounts[0],
      });

      // Get total number of news items
      const newsCount = await this.state.newsDetectionInstance.methods
        .getTotalNews()
        .call();
      this.setState({ newsCount: newsCount });

      // Get start and end values
      const start = await this.state.newsDetectionInstance.methods
        .getStart()
        .call();
      this.setState({ isElStarted: start });

      const end = await this.state.newsDetectionInstance.methods
        .getEnd()
        .call();
      this.setState({ isElEnded: end });

      // Load news details from blockchain
      const loadedNews = [];
      for (let i = 1; i <= this.state.newsCount; i++) {
        const news = await this.state.newsDetectionInstance.methods
          .newsDetails(i - 1)
          .call();
        loadedNews.push({
          id: news.newsId,
          newsPost: news.newsPost,
          voteCount: parseInt(news.voteCount) || 0,
          fakeCount: parseInt(news.fakeCount) || 0,
        });
      }

      this.setState({ newss: loadedNews });

      // Check admin status
      const admin = await this.state.newsDetectionInstance.methods
        .getAdmin()
        .call();
      if (this.state.account && admin && this.state.account.toLowerCase() === admin.toLowerCase()) {
        this.setState({ isAdmin: true });
      }

      // Automatically fetch NLP predictions for all news items
      this.fetchNlpPredictions(loadedNews);
    } catch (error) {
      console.error('Error during component initialization:', error);
      alert('Failed to load web3, accounts, or contract. Check console for details.');
    }
  };

  checkNlpHealth = async () => {
    try {
      const res = await fetch(`${NLP_API_URL}/api/health`, { method: 'GET' });
      if (res.ok) {
        this.setState({ nlpServiceOnline: true });
      } else {
        this.setState({ nlpServiceOnline: false });
      }
    } catch {
      this.setState({ nlpServiceOnline: false });
    }
  };

  fetchNlpPredictions = async (newsList) => {
    const predictions = {};
    for (const item of newsList) {
      try {
        const res = await fetch(`${NLP_API_URL}/api/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, text: item.newsPost }),
        });
        if (res.ok) {
          const data = await res.json();
          predictions[item.id] = data;
        } else {
          predictions[item.id] = this.getFallbackPrediction(item.newsPost);
        }
      } catch {
        // Fallback calculation if NLP server is not yet started
        predictions[item.id] = this.getFallbackPrediction(item.newsPost);
      }
    }
    this.setState({ nlpPredictions: predictions });
  };

  getFallbackPrediction = (text) => {
    const isSuspicious = /(shocking|secret|miracle|hoax|exposed|banned|cure)/i.test(text);
    return {
      prediction: isSuspicious ? 'Fake' : 'Authentic',
      authentic_percentage: isSuspicious ? 15.0 : 85.0,
      fake_percentage: isSuspicious ? 85.0 : 15.0,
      confidence: 0.85,
      keywords: ['heuristics-fallback'],
      credibility_flags: isSuspicious ? ['Sensational keywords detected (offline mode)'] : ['Institutional wording (offline mode)'],
    };
  };

  handleSyncFeedback = async (newsItem, groundTruthLabel) => {
    this.setState((prev) => ({
      syncLoading: { ...prev.syncLoading, [newsItem.id]: true },
    }));

    try {
      const res = await fetch(`${NLP_API_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newsItem.newsPost,
          label: groundTruthLabel,
        }),
      });

      if (res.ok) {
        this.setState((prev) => ({
          syncedFeedback: { ...prev.syncedFeedback, [newsItem.id]: true },
          syncLoading: { ...prev.syncLoading, [newsItem.id]: false },
        }));
        this.openAlert(
          "NLP Continuous Learning Updated!",
          `Decentralized consensus verdict (${groundTruthLabel === 1 ? 'Authentic' : 'Misinformation'}) was streamed into the continuous SGD classifier. Model weights updated incrementally.`,
          "success"
        );
      } else {
        this.openAlert("Sync Failed", "Could not submit feedback to the Python NLP model.", "warning");
        this.setState((prev) => ({
          syncLoading: { ...prev.syncLoading, [newsItem.id]: false },
        }));
      }
    } catch (err) {
      console.error('Continuous learning sync error:', err);
      this.openAlert("NLP Service Offline", "NLP Service is unreachable on port 5000. Please start 'python nlp_server.py'.", "danger");
      this.setState((prev) => ({
        syncLoading: { ...prev.syncLoading, [newsItem.id]: false },
      }));
    }
  };

  openCertificate = (newsItem, parsed, nlp, synthAuth, isFinalAuthentic) => {
    this.setState({
      activeCertificate: {
        id: newsItem.id,
        ...parsed,
        voteCount: newsItem.voteCount,
        fakeCount: newsItem.fakeCount,
        aiAnalysis: nlp,
        synthAuth: synthAuth,
        isFinalAuthentic: isFinalAuthentic,
      },
    });
  };

  renderOutcomesTable = () => {
    const { newss, nlpPredictions, syncedFeedback, syncLoading } = this.state;

    return (
      <div className="space-y-6">
        {newss.map((news) => {
          const totalVotes = news.voteCount + news.fakeCount;
          const humanAuth = totalVotes > 0 ? (news.voteCount / totalVotes) * 100 : 50;
          const humanFake = totalVotes > 0 ? (news.fakeCount / totalVotes) * 100 : 50;

          const parsed = parseNewsPost(news.newsPost);
          const headlineText = parsed.headline;

          const nlp = nlpPredictions[news.id] || this.getFallbackPrediction(headlineText);
          const nlpAuth = nlp.authentic_percentage;
          const nlpFake = nlp.fake_percentage;

          // Synthesized Dual-Verification Formula (50% Human Blockchain + 50% Machine NLP)
          const synthAuth = ((humanAuth * 0.5) + (nlpAuth * 0.5)).toFixed(1);
          const synthFake = ((humanFake * 0.5) + (nlpFake * 0.5)).toFixed(1);
          const isFinalAuthentic = parseFloat(synthAuth) >= 50;
          const groundTruthLabel = news.voteCount >= news.fakeCount ? 1 : 0;

          return (
            <div
              key={news.id}
              className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl transition-all hover:border-slate-600 space-y-4"
            >
              {/* Header: News ID, Certificate Action and Verdict Badge */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-700 text-slate-300">
                    News ID #{news.id}
                  </span>
                  <button
                    onClick={() => this.openCertificate(news, parsed, nlp, synthAuth, isFinalAuthentic)}
                    type="button"
                    className="text-xs font-bold px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span>📜 Export Certificate (PDF)</span>
                  </button>
                </div>

                <span
                  className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider ${
                    isFinalAuthentic
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {isFinalAuthentic ? '✓ Verified Authentic' : '⚠ Flagged Misinformation'}
                </span>
              </div>

              {/* Detected Media Preview */}
              {parsed.image && (
                <div className="max-h-56 overflow-hidden rounded-xl border border-slate-700 bg-black/40 flex items-center justify-center">
                  <img src={parsed.image} alt="News media" className="max-h-56 object-contain w-full" />
                </div>
              )}

              {/* News Headline */}
              <h3 className="text-lg md:text-xl font-bold text-white leading-snug">
                "{headlineText}"
              </h3>

              <div className="flex flex-wrap items-center gap-3">
                {parsed.source && (
                  <div className="text-xs text-sky-400 font-semibold">
                    Origin: {parsed.source}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() =>
                    this.setState({
                      viewingNews: {
                        id: news.id,
                        ...parsed,
                        voteCount: news.voteCount,
                        fakeCount: news.fakeCount,
                        aiAnalysis: nlp,
                      },
                    })
                  }
                  className="text-xs bg-slate-700/80 hover:bg-slate-700 text-sky-300 hover:text-white px-3 py-1 rounded-lg border border-slate-600 font-medium transition-colors inline-flex items-center gap-1"
                >
                  📖 View Full Story & XAI Breakdown &rarr;
                </button>
              </div>

              {/* Keywords and Flags */}
              {nlp.keywords && nlp.keywords.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">NLP Extracted Keywords:</span>
                  {nlp.keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/50 text-sky-300"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>
              )}

              {/* Three-Column Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Blockchain Consensus */}
                <div className="bg-slate-900/70 border border-slate-700/80 p-4 rounded-xl">
                  <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                    1. Blockchain Expert Consensus
                  </div>
                  <div className="text-2xl font-black text-sky-400 mb-1">
                    {humanAuth.toFixed(1)}% <span className="text-xs text-slate-400 font-normal">Authentic</span>
                  </div>
                  <div className="text-xs text-slate-400 space-y-0.5">
                    <div>Authentic Votes: <strong className="text-white">{news.voteCount}</strong></div>
                    <div>Fake Votes: <strong className="text-white">{news.fakeCount}</strong></div>
                    <div>Total Votes Cast: <strong className="text-white">{totalVotes}</strong></div>
                  </div>
                </div>

                {/* 2. Machine NLP Evaluation */}
                <div className="bg-slate-900/70 border border-slate-700/80 p-4 rounded-xl">
                  <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                    2. Deep Learning (NLP / BERT)
                  </div>
                  <div className="text-2xl font-black text-indigo-400 mb-1">
                    {nlpAuth}% <span className="text-xs text-slate-400 font-normal">Authentic</span>
                  </div>
                  <div className="text-xs text-slate-400 space-y-0.5">
                    <div>Model Classification: <strong className="text-white">{nlp.prediction}</strong></div>
                    <div>Fake Probability: <strong className="text-white">{nlpFake}%</strong></div>
                    <div>Confidence: <strong className="text-white">{((nlp.confidence || 0.85) * 100).toFixed(0)}%</strong></div>
                  </div>
                </div>

                {/* 3. Synthesized Final Result */}
                <div className="bg-slate-900/70 border border-sky-600/50 p-4 rounded-xl relative overflow-hidden">
                  <div className="text-xs text-sky-300 font-semibold uppercase tracking-wider mb-2">
                    3. Synthesized Final Verdict
                  </div>
                  <div className={`text-2xl font-black mb-1 ${isFinalAuthentic ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {synthAuth}% <span className="text-xs text-slate-400 font-normal">Authenticity Index</span>
                  </div>
                  <div className="text-xs text-slate-400 space-y-0.5">
                    <div>Misinformation Index: <strong className="text-white">{synthFake}%</strong></div>
                    <div>Formula: <strong className="text-white">50% Human + 50% AI</strong></div>
                    <div>Status: <strong className={isFinalAuthentic ? 'text-emerald-400' : 'text-rose-400'}>
                      {isFinalAuthentic ? 'Legitimate' : 'Misleading / Fake'}
                    </strong></div>
                  </div>
                </div>
              </div>

              {/* Credibility Signals Banner */}
              {nlp.credibility_flags && nlp.credibility_flags.length > 0 && (
                <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 text-xs text-slate-300">
                  <strong className="text-slate-200">AI Linguistic Signals: </strong>
                  {nlp.credibility_flags.join(' • ')}
                </div>
              )}

              {/* Continuous Learning Feedback Sync Action */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-700/60">
                <span className="text-xs text-slate-400">
                  Continuous Learning: Retrain NLP model with human consensus
                </span>
                {syncedFeedback[news.id] ? (
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    ✓ Feedback Assimilated into NLP Model
                  </span>
                ) : (
                  <button
                    onClick={() => this.handleSyncFeedback(news, groundTruthLabel)}
                    disabled={syncLoading[news.id]}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-medium text-xs py-2 px-4 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {syncLoading[news.id] ? 'Updating Model...' : '🔄 Feed Consensus into Continuous NLP'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  renderVisualAnalytics = () => {
    const { newss, nlpPredictions } = this.state;
    if (newss.length === 0) return null;

    let totalAuthentic = 0;
    let totalMisinfo = 0;
    let totalVotesCast = 0;
    let alignedCount = 0;

    const dataItems = newss.map((news) => {
      const totalVotes = news.voteCount + news.fakeCount;
      totalVotesCast += totalVotes;
      const humanAuth = totalVotes > 0 ? (news.voteCount / totalVotes) * 100 : 50;

      const parsed = parseNewsPost(news.newsPost);
      const headlineText = parsed.headline;
      const nlp = nlpPredictions[news.id] || this.getFallbackPrediction(headlineText);
      const nlpAuth = nlp.authentic_percentage;

      const synthAuth = ((humanAuth * 0.5) + (nlpAuth * 0.5)).toFixed(1);
      const isAuthentic = parseFloat(synthAuth) >= 50;

      if (isAuthentic) totalAuthentic++;
      else totalMisinfo++;

      const humanVerdict = humanAuth >= 50;
      const nlpVerdict = nlpAuth >= 50;
      if (humanVerdict === nlpVerdict) alignedCount++;

      return {
        news,
        parsed,
        nlp,
        humanAuth: parseFloat(humanAuth.toFixed(1)),
        nlpAuth: parseFloat(nlpAuth.toFixed(1)),
        synthAuth,
        isAuthentic,
        aligned: humanVerdict === nlpVerdict,
      };
    });

    const totalNews = newss.length;
    const authRate = Math.round((totalAuthentic / totalNews) * 100);
    const misinfoRate = Math.round((totalMisinfo / totalNews) * 100);
    const alignmentRate = Math.round((alignedCount / totalNews) * 100);

    return (
      <div className="space-y-6 animate-fade-in">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl shadow-lg">
            <span className="text-xs text-slate-400 font-medium block">Total Evaluated</span>
            <div className="text-2xl md:text-3xl font-extrabold text-white mt-1">{totalNews}</div>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{totalVotesCast} on-chain votes</span>
          </div>

          <div className="bg-slate-800/90 border border-emerald-500/30 p-4 rounded-2xl shadow-lg">
            <span className="text-xs text-emerald-400 font-medium block">Authentic Verified</span>
            <div className="text-2xl md:text-3xl font-extrabold text-emerald-300 mt-1">{authRate}%</div>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{totalAuthentic} of {totalNews} articles</span>
          </div>

          <div className="bg-slate-800/90 border border-rose-500/30 p-4 rounded-2xl shadow-lg">
            <span className="text-xs text-rose-400 font-medium block">Flagged Misinformation</span>
            <div className="text-2xl md:text-3xl font-extrabold text-rose-300 mt-1">{misinfoRate}%</div>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{totalMisinfo} of {totalNews} articles</span>
          </div>

          <div className="bg-slate-800/90 border border-indigo-500/30 p-4 rounded-2xl shadow-lg">
            <span className="text-xs text-indigo-400 font-medium block">Human-AI Alignment</span>
            <div className="text-2xl md:text-3xl font-extrabold text-indigo-300 mt-1">{alignmentRate}%</div>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{alignedCount} consensus match</span>
          </div>
        </div>

        {/* Visual Comparison Chart: Blockchain Human Consensus vs Deep Learning NLP */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-3">
            <div>
              <h3 className="text-lg font-bold text-white">
                Human Consensus vs. AI Machine Credibility (%)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Visualizing convergence and discrepancies between decentralized crowd evaluators and neural NLP classifications.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
                <span className="h-3 w-3 rounded bg-sky-400 inline-block" /> Human Consensus %
              </span>
              <span className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                <span className="h-3 w-3 rounded bg-indigo-400 inline-block" /> NLP Authenticity %
              </span>
            </div>
          </div>

          {/* SVG Comparative Bar Chart */}
          <div className="space-y-4">
            {dataItems.map((item) => (
              <div key={item.news.id} className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-sky-400">
                      #{item.news.id}
                    </span>
                    <span className="text-xs font-semibold text-white truncate max-w-md">
                      {item.parsed.headline}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      item.isAuthentic
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {item.isAuthentic ? 'Authentic' : 'Fake'} ({item.synthAuth}%)
                    </span>
                    <button
                      onClick={() => this.openCertificate(item.news, item.parsed, item.nlp, item.synthAuth, item.isAuthentic)}
                      className="text-[10px] font-semibold text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/30 border border-amber-500/30 px-2 py-0.5 rounded transition-colors"
                    >
                      Certificate 📄
                    </button>
                  </div>
                </div>

                {/* Progress Comparison Bars */}
                <div className="space-y-1.5 pt-1">
                  {/* Human Bar */}
                  <div className="flex items-center gap-2">
                    <span className="w-14 text-[10px] text-slate-400 font-medium">Human:</span>
                    <div className="flex-1 bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700/60 relative">
                      <div
                        className="bg-sky-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, item.humanAuth)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-[11px] font-mono font-bold text-sky-400">
                      {item.humanAuth}%
                    </span>
                  </div>

                  {/* AI Bar */}
                  <div className="flex items-center gap-2">
                    <span className="w-14 text-[10px] text-slate-400 font-medium">AI NLP:</span>
                    <div className="flex-1 bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700/60 relative">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, item.nlpAuth)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-[11px] font-mono font-bold text-indigo-400">
                      {item.nlpAuth}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Consensus Convergence Matrix */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-lg font-bold text-white">Consensus Convergence Matrix</h3>
          <p className="text-xs text-slate-400">
            Categorizing articles based on whether Human Evaluators and Machine Intelligence arrived at identical or divergent conclusions.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/80 border border-emerald-500/30 p-4 rounded-xl space-y-2">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center justify-between">
                <span>Unanimous Authentic</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                  {dataItems.filter((i) => i.humanAuth >= 50 && i.nlpAuth >= 50).length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Both on-chain human evaluators and AI neural networks classified the article as credible and authentic.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-rose-500/30 p-4 rounded-xl space-y-2">
              <div className="text-xs font-bold text-rose-400 uppercase tracking-wide flex items-center justify-between">
                <span>Unanimous Misinformation</span>
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px]">
                  {dataItems.filter((i) => i.humanAuth < 50 && i.nlpAuth < 50).length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Both consensus layers strongly flagged the statement as fabricated or intentionally deceptive misinformation.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-amber-500/30 p-4 rounded-xl space-y-2">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center justify-between">
                <span>Divergent / Disputed</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                  {dataItems.filter((i) => !i.aligned).length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Disagreements where human consensus broke from NLP prediction, resolved through weighted hybrid synthesis.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  render() {
    const isPortalAdmin = sessionStorage.getItem('portalRole') === 'admin';

    if (!this.state.web3) {
      return (
        <>
          {isPortalAdmin ? <NavbarAdmin /> : <Navbar />}
          <div className="flex items-center justify-center min-h-[60vh] text-slate-300">
            Connecting to Web3 & Blockchain...
          </div>
        </>
      );
    }

    return (
      <div className="md:ml-64 pt-16 md:pt-6 px-4 pb-12 min-h-screen">
        {isPortalAdmin ? <NavbarAdmin /> : <Navbar />}

        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-sky-950 via-slate-900 to-indigo-950 border border-sky-800/40 p-6 rounded-2xl shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 uppercase tracking-wide">
                  Synthesis & Verification Engine
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-2">
                  Blockchain & NLP Integrated Final Outcomes
                </h1>
                <p className="text-slate-400 text-xs md:text-sm mt-1">
                  Dual-layer verification combining Ethereum smart contract consensus with Continuous Deep Learning NLP.
                </p>
              </div>

              {/* View Switcher & NLP Service Status */}
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-xl">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      this.state.nlpServiceOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <div className="text-xs">
                    <span className="text-slate-300 font-medium">
                      NLP (5000):{' '}
                      <strong className={this.state.nlpServiceOnline ? 'text-emerald-400' : 'text-amber-400'}>
                        {this.state.nlpServiceOnline ? 'Live' : 'Fallback'}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700">
                  <button
                    onClick={() => this.setState({ viewMode: 'cards' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      this.state.viewMode === 'cards'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📋 Outcome Cards
                  </button>
                  <button
                    onClick={() => this.setState({ viewMode: 'analytics' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      this.state.viewMode === 'analytics'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📊 Visual Analytics
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          {!this.state.isElStarted && !this.state.isElEnded ? (
            <NotInit />
          ) : this.state.isElStarted && !this.state.isElEnded ? (
            <div className="bg-slate-800 border border-slate-700 text-white p-8 rounded-2xl text-center shadow-lg">
              <h3 className="text-xl font-bold mb-2">Evaluation Round in Progress</h3>
              <p className="text-slate-300 text-sm mb-4">
                Verified evaluators are currently casting votes on-chain. Final synthesized outcomes will appear once the administrator concludes the evaluation round.
              </p>
              <Link
                to="/Voting"
                className="inline-block bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm py-2 px-6 rounded-lg transition-colors"
              >
                Go to Voting Page &rarr;
              </Link>
            </div>
          ) : !this.state.isElStarted && this.state.isElEnded ? (
            this.state.newss.length > 0 ? (
              this.state.viewMode === 'cards' ? (
                this.renderOutcomesTable()
              ) : (
                this.renderVisualAnalytics()
              )
            ) : (
              <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl text-center text-slate-400">
                No news items found on this blockchain round.
              </div>
            )
          ) : null}
        </div>

        {/* Full News Reader Modal with Sentence-Level XAI */}
        <NewsDetailModal
          isOpen={Boolean(this.state.viewingNews)}
          news={this.state.viewingNews}
          onClose={() => this.setState({ viewingNews: null })}
        />

        {/* Exportable Cryptographic Verification Certificate Modal */}
        <VerificationCertificateModal
          isOpen={Boolean(this.state.activeCertificate)}
          news={this.state.activeCertificate}
          contractAddress={
            (this.state.newsDetectionInstance && this.state.newsDetectionInstance._address) ||
            (newsDetection.networks[this.state.networkId] && newsDetection.networks[this.state.networkId].address) ||
            '0x0000000000000000000000000000000000000000'
          }
          adminAddress={this.state.account || ''}
          onClose={() => this.setState({ activeCertificate: null })}
        />

        {/* Custom Confirmation / Alert Modal */}
        {this.state.alertModal && (
          <ConfirmModal
            isOpen={this.state.alertModal.isOpen}
            type={this.state.alertModal.type}
            title={this.state.alertModal.title}
            message={this.state.alertModal.message}
            confirmText={this.state.alertModal.confirmText}
            onClose={this.state.alertModal.onClose || (() => this.setState({ alertModal: null }))}
            onConfirm={this.state.alertModal.onConfirm}
          />
        )}
      </div>
    );
  }
}
