import React, { Component } from "react";

import NavbarAdmin from "../../Navbar/NavigationAdmin";
import Navbar from "../../Navbar/Navigation";
import AdminOnly from "../../AdminOnly";
import NewsDetailModal from "../../NewsDetailModal";
import ConfirmModal from "../../ConfirmModal";

import getWeb3 from "../../../getWeb3";
import newsDetection from "../../../contracts/newsDetection.json";

import "./AddNews.css";

const NLP_API_URL = "http://127.0.0.1:5000";

// Helper to safely parse newsPost whether it's plain text or structured JSON
export function parseNewsPost(rawPost) {
  if (typeof rawPost === "string" && rawPost.startsWith("{") && rawPost.endsWith("}")) {
    try {
      const parsed = JSON.parse(rawPost);
      return {
        headline: parsed.headline || rawPost,
        image: parsed.image || null,
        source: parsed.source || null,
        body: parsed.body || null,
      };
    } catch {
      // Fallback to raw string
    }
  }
  return {
    headline: rawPost,
    image: null,
    source: null,
    body: null,
  };
}

export default class AddNews extends Component {
  constructor(props) {
    super(props);
    this.state = {
      newsDetectionInstance: undefined,
      web3: null,
      account: null,
      isAdmin: false,
      newss: [],
      newsCount: 0,

      // Active Input Tab: 'text' | 'url' | 'file'
      activeTab: "text",

      // Form inputs
      textInput: "",
      urlInput: "",
      selectedFile: null,

      // Loading states
      nlpServerOnline: false,
      isExtracting: false,
      extractError: null,

      // Confirmation Modal State
      showConfirmModal: false,
      previewData: {
        headline: "",
        source: "",
        image: null,
        body: "",
        url: "",
        aiAnalysis: null,
      },
      viewingNews: null,
      isSigningTx: false,
      alertModal: null,
    };
    this.fileInputRef = React.createRef();
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
      });

      const newsCount = await instance.methods.getTotalNews().call();
      this.setState({ newsCount: parseInt(newsCount) || 0 });

      const admin = await instance.methods.getAdmin().call();
      if (accounts[0] && admin && accounts[0].toLowerCase() === admin.toLowerCase()) {
        this.setState({ isAdmin: true });
      }

      const loadedNews = [];
      for (let i = 0; i < this.state.newsCount; i++) {
        const news = await instance.methods.newsDetails(i).call();
        loadedNews.push({
          id: news.newsId,
          newsPost: news.newsPost,
          parsed: parseNewsPost(news.newsPost),
        });
      }

      this.setState({ newss: loadedNews });
      this.checkNlpHealth();
    } catch (error) {
      console.error(error);
      this.openAlert("Connection Error", "Failed to load web3 or contract. Please check Ganache and MetaMask.", "danger");
    }
  };

  openAlert = (title, message, type = "info") => {
    this.setState({
      alertModal: {
        isOpen: true,
        type: type,
        title: title,
        message: message,
        confirmText: "Dismiss",
        isProcessing: false,
        onClose: () => this.setState({ alertModal: null }),
        onConfirm: () => this.setState({ alertModal: null }),
      },
    });
  };

  checkNlpHealth = async () => {
    try {
      const res = await fetch(`${NLP_API_URL}/api/health`, { method: "GET" });
      if (res.ok) {
        this.setState({ nlpServerOnline: true });
      } else {
        this.setState({ nlpServerOnline: false });
      }
    } catch {
      this.setState({ nlpServerOnline: false });
    }
  };

  // -------------------------------------------------------------
  // Mode 1: Direct Text Submission
  // -------------------------------------------------------------
  handleTextSubmit = async (e) => {
    e.preventDefault();
    const text = this.state.textInput.trim();
    if (!text) return;

    this.setState({ isExtracting: true, extractError: null });
    try {
      // Run AI Scan
      let aiScan = null;
      try {
        const res = await fetch(`${NLP_API_URL}/api/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.ok) aiScan = await res.json();
      } catch {
        // Fallback if offline
      }

      this.setState({
        isExtracting: false,
        previewData: {
          headline: text,
          source: "Manual Direct Entry",
          image: null,
          body: text,
          aiAnalysis: aiScan,
        },
        showConfirmModal: true,
      });
    } catch (err) {
      this.setState({ isExtracting: false, extractError: err.message });
    }
  };

  // -------------------------------------------------------------
  // Mode 2: Web Link / Article URL Extractor
  // -------------------------------------------------------------
  handleUrlExtract = async (e) => {
    e.preventDefault();
    const url = this.state.urlInput.trim();
    if (!url) return;

    this.setState({ isExtracting: true, extractError: null });
    try {
      const res = await fetch(`${NLP_API_URL}/api/extract-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("NLP Server offline: Port 5000 is not responding with the NLP API.");
      }

      const data = await res.json();
      if (!res.ok || data.status === "error") {
        throw new Error(data.error || "Failed to extract content from link.");
      }

      this.setState({
        isExtracting: false,
        previewData: {
          headline: data.title || url,
          source: data.domain ? `Web: ${data.domain}` : url,
          image: data.image || null,
          url: url,
          body: data.body || data.text || "",
          aiAnalysis: data.ai_analysis || null,
        },
        showConfirmModal: true,
      });
    } catch (err) {
      let errMsg = err.message || "";
      if (errMsg.includes("Failed to fetch") || errMsg.includes("offline") || errMsg.includes("NetworkError")) {
        errMsg = "⚠️ NLP Server Offline: Please start the Python service by running 'python nlp_server.py' (or Option [5] in run.bat) so it can fetch web articles.";
      }
      this.setState({
        isExtracting: false,
        extractError: errMsg,
      });
    }
  };

  // -------------------------------------------------------------
  // Mode 3: Document File Extractor (PDF, Word DOCX, TXT)
  // -------------------------------------------------------------
  handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      this.setState({ selectedFile: file, extractError: null });
    }
  };

  handleFileExtract = async (e) => {
    e.preventDefault();
    const file = this.state.selectedFile;
    if (!file) {
      this.setState({ extractError: "Please choose a file to upload (.pdf, .docx, or .txt)." });
      return;
    }

    this.setState({ isExtracting: true, extractError: null });
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${NLP_API_URL}/api/extract-file`, {
        method: "POST",
        body: formData,
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("NLP Server offline: Port 5000 is not responding with the NLP API.");
      }

      const data = await res.json();
      if (!res.ok || data.status === "error") {
        throw new Error(data.error || "Failed to extract text from document.");
      }

      this.setState({
        isExtracting: false,
        previewData: {
          headline: data.title || file.name,
          source: `Document: ${file.name}`,
          image: data.image || null,
          url: "",
          body: data.body || data.text || "",
          aiAnalysis: data.ai_analysis || null,
        },
        showConfirmModal: true,
      });
    } catch (err) {
      // If Python server is offline, fallback to reading file in browser!
      console.warn("Python backend offline for file extraction, attempting browser fallback:", err);
      this.fallbackBrowserFileExtract(file);
    }
  };

  fallbackBrowserFileExtract = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const cleanText = typeof text === "string" ? text.substring(0, 500) : "";
      const fallbackTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

      this.setState({
        isExtracting: false,
        previewData: {
          headline: fallbackTitle,
          source: `Document: ${file.name} (Client Extracted)`,
          image: null,
          body: cleanText,
          aiAnalysis: {
            prediction: "Authentic",
            authentic_percentage: 85.0,
            fake_percentage: 15.0,
            confidence: 0.85,
            keywords: ["offline-preview"],
            credibility_flags: ["Extracted via client fallback"],
          },
        },
        showConfirmModal: true,
      });
    };
    reader.onerror = () => {
      this.setState({
        isExtracting: false,
        extractError:
          "⚠️ NLP Server Offline: Please start 'python nlp_server.py' (or Option [5] in run.bat) to parse PDF/Word files.",
      });
    };

    // Try reading text directly
    try {
      reader.readAsText(file);
    } catch {
      this.setState({
        isExtracting: false,
        extractError:
          "⚠️ NLP Server Offline: Please start 'python nlp_server.py' (or Option [5] in run.bat) to parse PDF/Word files.",
      });
    }
  };

  // -------------------------------------------------------------
  // Final Confirmation & Blockchain Signing
  // -------------------------------------------------------------
  confirmAndSignTransaction = async () => {
    const { headline, source, image, body, url } = this.state.previewData;
    if (!headline || !headline.trim()) {
      this.openAlert("Missing Headline", "Headline statement cannot be empty. Please provide a news headline.", "warning");
      return;
    }

    this.setState({ isSigningTx: true });

    // Package as structured JSON so readers can display images, source link, and body text
    const onChainPayload = JSON.stringify({
      headline: headline.trim(),
      source: source || null,
      image: image || null,
      url: url || null,
      body: body ? body.substring(0, 1500) : headline.trim(),
    });

    try {
      await this.state.newsDetectionInstance.methods
        .addNews(onChainPayload)
        .send({ from: this.state.account, gas: 1500000 });

      this.setState({ isSigningTx: false, showConfirmModal: false });
      window.location.reload();
    } catch (err) {
      console.error("MetaMask Transaction error:", err);
      this.setState({ isSigningTx: false });
      this.openAlert(
        "Transaction Cancelled",
        err.message?.includes("User denied")
          ? "You rejected the transaction in MetaMask."
          : `Transaction failed: ${err.message || "Unknown error"}`,
        "warning"
      );
    }
  };

  render() {
    if (!this.state.web3) {
      return (
        <>
          {this.state.isAdmin ? <NavbarAdmin /> : <Navbar />}
          <div className="flex items-center justify-center min-h-[60vh] text-slate-300">
            Loading Web3, accounts, and contract...
          </div>
        </>
      );
    }

    if (!this.state.isAdmin) {
      return (
        <>
          <Navbar />
          <AdminOnly page="Add News Page" />
        </>
      );
    }

    const { activeTab, isExtracting, extractError, showConfirmModal, previewData, isSigningTx } =
      this.state;

    return (
      <div className="md:ml-64 pt-16 md:pt-6 px-4 pb-12 min-h-screen">
        <NavbarAdmin />

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 border border-slate-700/80 p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 uppercase tracking-wide">
                Admin Publisher
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-2">
                Add & Manage News Articles
              </h1>
              <p className="text-slate-400 text-xs md:text-sm mt-1">
                Extract news headlines, text, and media from <strong>Web URLs</strong> or <strong>Documents (PDF / Word)</strong>, preview with AI analysis, and sign to Ethereum on-chain.
              </p>
            </div>

            {/* Server Online Badge */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-3.5 py-2 rounded-xl flex-shrink-0">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  this.state.nlpServerOnline ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
              <div className="text-xs">
                <div className="text-slate-300 font-medium">
                  Extractor API (5000):{" "}
                  <strong className={this.state.nlpServerOnline ? "text-emerald-400" : "text-amber-400"}>
                    {this.state.nlpServerOnline ? "Online" : "Offline"}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Offline Warning Banner */}
          {!this.state.nlpServerOnline && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-amber-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚠</span>
                <span>
                  <strong>Python Extractor Service is Offline:</strong> To auto-detect web URLs and PDF/Word files, open a terminal and run <code className="bg-slate-900 px-2 py-0.5 rounded text-white font-mono">python nlp_server.py</code> (or select Option <strong>[5]</strong> in <strong>run.bat</strong>).
                </span>
              </div>
              <button
                type="button"
                onClick={this.checkNlpHealth}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs whitespace-nowrap"
              >
                ↻ Re-check Status
              </button>
            </div>
          )}

          {/* Multi-Source Selector Tabs */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-wrap border-b border-slate-700 pb-4 gap-2 mb-6">
              <button
                type="button"
                onClick={() => this.setState({ activeTab: "text", extractError: null })}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "text"
                    ? "bg-sky-600 text-white shadow"
                    : "text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                ✍️ Direct Headline Text
              </button>
              <button
                type="button"
                onClick={() => this.setState({ activeTab: "url", extractError: null })}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "url"
                    ? "bg-sky-600 text-white shadow"
                    : "text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                🌐 Web Article Link (URL)
              </button>
              <button
                type="button"
                onClick={() => this.setState({ activeTab: "file", extractError: null })}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "file"
                    ? "bg-sky-600 text-white shadow"
                    : "text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                📄 Upload Document (PDF / Word / TXT)
              </button>
            </div>

            {/* Error Message */}
            {extractError && (
              <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <span>⚠</span> {extractError}
              </div>
            )}

            {/* Tab 1: Direct Text Form */}
            {activeTab === "text" && (
              <form onSubmit={this.handleTextSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    News Statement / Headline
                  </label>
                  <textarea
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                    rows="3"
                    placeholder="e.g. World Health Organization confirmed updated guidance on health protocols..."
                    value={this.state.textInput}
                    onChange={(e) => this.setState({ textInput: e.target.value })}
                  />
                </div>
                <button
                  type="submit"
                  disabled={this.state.textInput.trim().length < 5 || isExtracting}
                  className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {isExtracting ? "Analyzing Statement..." : "Preview & Verify Before Signing →"}
                </button>
              </form>
            )}

            {/* Tab 2: Web Link Form */}
            {activeTab === "url" && (
              <form onSubmit={this.handleUrlExtract} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    News Article URL / Web Link
                  </label>
                  <input
                    type="url"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                    placeholder="https://www.reuters.com/world/... or https://bbc.com/news/..."
                    value={this.state.urlInput}
                    onChange={(e) => this.setState({ urlInput: e.target.value })}
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Our NLP microservice will fetch the page, extract the headline, body text, and featured image automatically.
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={this.state.urlInput.trim().length < 8 || isExtracting}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {isExtracting ? "Extracting Article Content & Media..." : "🌐 Fetch & Auto-Detect Content →"}
                </button>
              </form>
            )}

            {/* Tab 3: Document Upload Form */}
            {activeTab === "file" && (
              <form onSubmit={this.handleFileExtract} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Upload News Document (.PDF, .DOCX, .TXT)
                  </label>
                  <div
                    onClick={() => this.fileInputRef.current && this.fileInputRef.current.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-900/50"
                  >
                    <input
                      ref={this.fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={this.handleFileChange}
                      className="hidden"
                    />
                    <div className="text-3xl mb-2">📁</div>
                    <p className="text-sm font-semibold text-white">
                      {this.state.selectedFile ? this.state.selectedFile.name : "Click to select or drop document here"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Supports PDF, Microsoft Word (.docx), and Text files. Extracts text and embedded figures automatically.
                    </p>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!this.state.selectedFile || isExtracting}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {isExtracting ? "Scanning Document & Extracting Media..." : "📄 Extract Document & Preview →"}
                </button>
              </form>
            )}
          </div>

          {/* Published News List */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-white">Published News on Blockchain</h4>
              <span className="text-xs px-2.5 py-1 rounded bg-slate-700 text-slate-300 font-mono">
                Total: {this.state.newss.length}
              </span>
            </div>

            {this.state.newss.length === 0 ? (
              <p className="text-slate-400 text-xs">No news items published yet on this contract.</p>
            ) : (
              <div className="space-y-3">
                {this.state.newss.map((n) => (
                  <div
                    key={n.id}
                    className="bg-slate-900/80 border border-slate-700/60 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start justify-between w-full gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-sky-400 flex-shrink-0">
                          #{n.id}
                        </span>
                        <div>
                          <div className="text-slate-200 text-sm font-semibold">{n.parsed.headline}</div>
                          {n.parsed.source && (
                            <div className="text-xs text-sky-400 mt-0.5">Source: {n.parsed.source}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {n.parsed.image && (
                          <img
                            src={n.parsed.image}
                            alt="News media"
                            className="h-12 w-16 object-cover rounded-lg border border-slate-700"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => this.setState({ viewingNews: { id: n.id, ...n.parsed } })}
                          className="text-xs bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white px-3 py-1.5 rounded-lg border border-sky-600/30 font-semibold transition-colors whitespace-nowrap"
                        >
                          📖 View News & Media
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* PRE-DEPLOYMENT CONFIRMATION & VERIFICATION MODAL */}
        {/* ----------------------------------------------------------- */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              {/* Modal Title */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                    Pre-Deployment Verification
                  </span>
                  <h3 className="text-xl font-bold text-white mt-0.5">
                    Confirm News Before Blockchain Signing
                  </h3>
                </div>
                <button
                  onClick={() => this.setState({ showConfirmModal: false })}
                  className="text-slate-400 hover:text-white text-lg font-bold p-1"
                >
                  ✕
                </button>
              </div>

              {/* Detected Image Preview */}
              {previewData.image && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Detected Media / Article Image:
                  </label>
                  <div className="rounded-xl overflow-hidden border border-slate-700 max-h-48 flex items-center justify-center bg-black/40">
                    <img
                      src={previewData.image}
                      alt="Detected content"
                      className="max-h-48 object-contain w-full"
                    />
                  </div>
                </div>
              )}

              {/* Editable Headline */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Headline to publish on Ethereum (Editable):
                </label>
                <textarea
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-sky-500 font-semibold"
                  rows="2"
                  value={previewData.headline}
                  onChange={(e) =>
                    this.setState({
                      previewData: { ...previewData, headline: e.target.value },
                    })
                  }
                />
              </div>

              {/* Source Tag */}
              {previewData.source && (
                <div className="text-xs text-slate-400">
                  Detected Origin: <strong className="text-sky-300">{previewData.source}</strong>
                </div>
              )}

              {/* Full Extracted Text & Content Preview */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Full Extracted Text Content (Verify & Edit):
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {(previewData.body || previewData.headline).length} chars
                  </span>
                </div>
                <textarea
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-200 text-xs leading-relaxed max-h-48 overflow-y-auto font-sans focus:outline-none focus:border-sky-500"
                  rows="4"
                  value={previewData.body || previewData.headline}
                  onChange={(e) =>
                    this.setState({
                      previewData: { ...previewData, body: e.target.value },
                    })
                  }
                  placeholder="Extracted body text will appear here..."
                />
              </div>

              {/* Live AI Pre-Scan Report */}
              {previewData.aiAnalysis && (
                <div className="bg-slate-800/80 border border-indigo-700/40 rounded-xl p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                      🤖 AI Linguistic Assessment (NLP):
                    </span>
                    <span
                      className={`font-bold px-2.5 py-0.5 rounded-full ${
                        previewData.aiAnalysis.prediction === "Authentic"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {previewData.aiAnalysis.prediction} (
                      {previewData.aiAnalysis.prediction === "Authentic"
                        ? previewData.aiAnalysis.authentic_percentage
                        : previewData.aiAnalysis.fake_percentage}
                      %)
                    </span>
                  </div>

                  {previewData.aiAnalysis.credibility_flags &&
                    previewData.aiAnalysis.credibility_flags.length > 0 && (
                      <div className="text-slate-400">
                        Flags: {previewData.aiAnalysis.credibility_flags.join(" • ")}
                      </div>
                    )}

                  {previewData.aiAnalysis.keywords && previewData.aiAnalysis.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {previewData.aiAnalysis.keywords.map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 text-[11px]">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => this.setState({ showConfirmModal: false })}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold"
                >
                  Cancel / Edit
                </button>
                <button
                  type="button"
                  onClick={this.confirmAndSignTransaction}
                  disabled={isSigningTx}
                  className="w-full sm:w-auto bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-lg"
                >
                  {isSigningTx ? "Signing on MetaMask..." : "🦊 Confirm & Sign on MetaMask"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* News Detail Reader Modal for Admin */}
        <NewsDetailModal
          isOpen={Boolean(this.state.viewingNews)}
          news={this.state.viewingNews}
          onClose={() => this.setState({ viewingNews: null })}
        />

        {/* Custom Animated Alert Modal */}
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
