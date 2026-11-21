// Node modules
import React, { Component } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import {
  FolderAddIcon,
  UserGroupIcon,
  ChartPieIcon,
  StopIcon,
  ShieldCheckIcon,
  SearchIcon,
} from '@heroicons/react/outline';

// Components
import Navbar from './Navbar/Navigation';
import NavbarAdmin from './Navbar/NavigationAdmin';
import UserHome from './UserHome';
import ConfirmModal from './ConfirmModal';
import PortalLogin from './Auth/PortalLogin';

// Contract
import getWeb3 from '../getWeb3';
import newsDetection from '../contracts/newsDetection.json';

// CSS
import './Home.css';

export default class Home extends Component {
  constructor(props) {
    super(props);
    this.state = {
      newsDetectionInstance: undefined,
      account: null,
      web3: null,
      isAdmin: false,
      elStarted: false,
      elEnded: false,
      elDetails: {},
      portalRole: sessionStorage.getItem('portalRole') || null,
      confirmModal: null,
    };
  }

  componentDidMount = async () => {
    window.addEventListener('metamaskAccountChanged', this.handleAccountChange);

    if (window.ethereum) {
      this.accountsHandler = (accounts) => {
        this.initBlockchain(accounts);
      };
      window.ethereum.on('accountsChanged', this.accountsHandler);
    }

    await this.initBlockchain();
  };

  componentWillUnmount() {
    window.removeEventListener('metamaskAccountChanged', this.handleAccountChange);
    if (window.ethereum && this.accountsHandler) {
      window.ethereum.removeListener('accountsChanged', this.accountsHandler);
    }
  }

  handleAccountChange = () => {
    this.initBlockchain();
  };

  initBlockchain = async (passedAccounts = null) => {
    try {
      const web3 = await getWeb3();

      let accounts = passedAccounts || (await web3.eth.getAccounts());
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
        null;

      const networkId = await web3.eth.net.getId();
      const deployedNetwork =
        newsDetection.networks[networkId] ||
        newsDetection.networks['1337'] ||
        newsDetection.networks['5777'];

      if (!deployedNetwork || !deployedNetwork.address) {
        throw new Error(
          `Contract not deployed on Network ID ${networkId}. Please migrate contracts to Ganache.`
        );
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

      this.setState({
        web3: web3,
        newsDetectionInstance: instance,
        account: currentAccount,
        isAdmin: isAdmin,
      });

      // Get newsDetection start and end values
      const start = await instance.methods.getStart().call();
      this.setState({ elStarted: start });

      const end = await instance.methods.getEnd().call();
      this.setState({ elEnded: end });

      // Getting newsDetection details from the contract
      const adminName = await instance.methods.getAdminName().call();
      const adminEmail = await instance.methods.getAdminEmail().call();
      const newsdetectionTitle = await instance.methods.getnewsDetectionTitle().call();

      this.setState({
        elDetails: {
          adminName: adminName,
          adminEmail: adminEmail,
          newsdetectionTitle: newsdetectionTitle,
        },
      });
    } catch (error) {
      console.error('Home initialization error:', error);
    }
  };

  handleSwitchAccountPrompt = async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
        await this.initBlockchain();
      } catch (err) {
        console.warn('User cancelled account switch:', err);
      }
    }
  };

  // Alert Modal
  openAlert = (title, message, type = 'info') => {
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

  promptEndRound = () => {
    this.setState({
      confirmModal: {
        isOpen: true,
        type: 'danger',
        title: 'Conclude Evaluation Round?',
        message:
          'Are you sure you want to officially end this round? Evaluators will no longer be able to submit votes, and the results will be locked for final NLP synthesis.',
        confirmText: 'Yes, End Round',
        cancelText: 'Cancel',
        isProcessing: false,
        onClose: () => this.setState({ confirmModal: null }),
        onConfirm: this.endnewsDetection,
      },
    });
  };

  endnewsDetection = async () => {
    this.setState((prev) => ({
      confirmModal: prev.confirmModal
        ? {
            ...prev.confirmModal,
            isProcessing: true,
            processingText: 'Ending session on MetaMask...',
          }
        : null,
    }));
    try {
      await this.state.newsDetectionInstance.methods
        .endnewsDetection()
        .send({ from: this.state.account, gas: 1000000 });
      this.setState({ confirmModal: null });
      window.location.reload();
    } catch (err) {
      console.error(err);
      this.setState({ confirmModal: null });
      this.openAlert(
        'Action Cancelled',
        err.message?.includes('User denied')
          ? 'Transaction was rejected in MetaMask.'
          : `Failed to end session: ${err.message}`,
        'warning'
      );
    }
  };

  // register and start newsDetection
  registernewsDetection = async (data) => {
    try {
      await this.state.newsDetectionInstance.methods
        .setnewsDetectionDetails(
          data.adminFName.toLowerCase() + ' ' + data.adminLName.toLowerCase(),
          data.adminEmail.toLowerCase(),
          data.newsdetectionTitle.toLowerCase()
        )
        .send({ from: this.state.account, gas: 1000000 });
      window.location.reload();
    } catch (err) {
      console.error(err);
      this.openAlert(
        'Setup Error',
        err.message?.includes('User denied')
          ? 'Transaction was rejected in MetaMask.'
          : `Failed to initialize session: ${err.message}`,
        'warning'
      );
    }
  };

  render() {
    const portalRole = sessionStorage.getItem('portalRole') || this.state.portalRole;

    // 1. Gateway Screen: If user has not selected and authenticated into a portal
    if (!portalRole) {
      return (
        <PortalLogin
          onLoginSuccess={(role) => {
            this.setState({ portalRole: role });
          }}
        />
      );
    }

    // 2. Loading state while Web3 initializes
    if (!this.state.web3) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
          <div className="text-center p-6 bg-slate-800 rounded-xl border border-slate-700">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-400 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">Connecting to Web3 & Ethereum Network...</p>
          </div>
        </div>
      );
    }

    const isAdminView = portalRole === 'admin';

    return (
      <div className="md:ml-64 pt-16 md:pt-6 px-4 pb-12 min-h-screen">
        {isAdminView ? <NavbarAdmin /> : <Navbar />}

        <div className="w-full max-w-4xl mx-auto space-y-4 mb-6">
          {/* User Account & Role Banner */}
          <div className="rounded-2xl bg-slate-800/90 border border-slate-700 p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="overflow-hidden">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-0.5">
                Connected MetaMask Wallet
              </span>
              <p className="text-sm font-mono text-emerald-400 break-all font-semibold">
                {this.state.account || 'Connecting wallet...'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isAdminView ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-600">
                  <ShieldCheckIcon className="h-4 w-4" />
                  BLOCKCHAIN ADMIN
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-950 text-sky-300 border border-sky-600">
                  <SearchIcon className="h-4 w-4" />
                  EVALUATOR WORKSPACE
                </span>
              )}
              <button
                onClick={this.handleSwitchAccountPrompt}
                type="button"
                className="text-xs bg-slate-700 hover:bg-sky-600 text-white font-semibold py-1 px-3 rounded-lg border border-slate-600 transition-colors cursor-pointer shadow"
              >
                Switch Wallet ⇄
              </button>
            </div>
          </div>
        </div>

        {/* Dedicated Portal Content */}
        {isAdminView ? this.renderAdminPortal() : this.renderEvaluatorPortal()}

        {/* Custom Confirmation / Alert Modal */}
        {this.state.confirmModal && (
          <ConfirmModal
            isOpen={this.state.confirmModal.isOpen}
            type={this.state.confirmModal.type}
            title={this.state.confirmModal.title}
            message={this.state.confirmModal.message}
            confirmText={this.state.confirmModal.confirmText}
            cancelText={this.state.confirmModal.cancelText}
            isProcessing={this.state.confirmModal.isProcessing}
            processingText={this.state.confirmModal.processingText}
            onClose={
              this.state.confirmModal.onClose ||
              (() => this.setState({ confirmModal: null }))
            }
            onConfirm={this.state.confirmModal.onConfirm}
          />
        )}
      </div>
    );
  }

  // ================= ADMIN PORTAL =================
  renderAdminPortal = () => {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* If session not started */}
        {!this.state.elStarted && !this.state.elEnded ? (
          <div className="bg-slate-800 border border-slate-700 p-6 md:p-8 rounded-2xl shadow-xl">
            <div className="mb-6">
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 uppercase tracking-wide">
                Setup Required
              </span>
              <h2 className="text-2xl font-bold text-white mt-2">Initialize News Detection Session</h2>
              <p className="text-slate-400 text-sm mt-1">
                Configure your administrator profile and name the evaluation session to activate the round.
              </p>
            </div>
            <this.AdminSetupForm />
          </div>
        ) : (
          /* If session is active or ended */
          <div className="space-y-6">
            {/* Status Card */}
            <div
              className={`p-6 rounded-2xl border shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                this.state.elStarted && !this.state.elEnded
                  ? 'bg-emerald-950/40 border-emerald-600/50'
                  : 'bg-slate-800 border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      this.state.elStarted && !this.state.elEnded
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-rose-500'
                    }`}
                  />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    {this.state.elStarted && !this.state.elEnded
                      ? 'Evaluation Round Active'
                      : 'Evaluation Round Concluded'}
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-extrabold text-white mt-1 capitalize">
                  {this.state.elDetails.newsdetectionTitle || 'Fact-Checking Session'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Admin:{' '}
                  <strong className="text-slate-200 capitalize">
                    {this.state.elDetails.adminName}
                  </strong>{' '}
                  ({this.state.elDetails.adminEmail})
                </p>
              </div>

              {this.state.elStarted && !this.state.elEnded && (
                <button
                  onClick={this.promptEndRound}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2.5 px-5 rounded-lg text-sm flex items-center gap-2 shadow-lg transition-colors cursor-pointer"
                >
                  <StopIcon className="h-5 w-5" />
                  End Round
                </button>
              )}
            </div>

            {/* Admin Management Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl flex flex-col justify-between hover:border-emerald-500 transition-all shadow-lg">
                <div>
                  <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                    <FolderAddIcon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Add & Manage News</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Submit news statements, URL articles, or PDF documents into smart contract storage with AI analysis.
                  </p>
                </div>
                <Link
                  to="/AddNews"
                  className="mt-5 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 px-4 rounded-lg text-sm text-center block transition-colors"
                >
                  Add News &rarr;
                </Link>
              </div>

              <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl flex flex-col justify-between hover:border-sky-500 transition-all shadow-lg">
                <div>
                  <div className="h-12 w-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-4">
                    <UserGroupIcon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Authenticate Evaluators</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Review incoming registrations and verify legitimate journalists and community members to evaluate.
                  </p>
                </div>
                <Link
                  to="/Verification"
                  className="mt-5 w-full bg-sky-600 hover:bg-sky-500 text-white font-medium py-2 px-4 rounded-lg text-sm text-center block transition-colors"
                >
                  Manage Evaluators &rarr;
                </Link>
              </div>

              <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl flex flex-col justify-between hover:border-indigo-500 transition-all shadow-lg">
                <div>
                  <div className="h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
                    <ChartPieIcon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Final Outcomes (NLP)</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    View dual-verification synthesis combining decentralized votes with the continuous NLP model.
                  </p>
                </div>
                <Link
                  to="/Final_Outcomes"
                  className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg text-sm text-center block transition-colors"
                >
                  View Final Results &rarr;
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  AdminSetupForm = () => {
    const {
      handleSubmit,
      register,
      formState: { errors },
    } = useForm();

    const onSubmit = (data) => {
      this.registernewsDetection(data);
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">First Name *</label>
            <input
              className="bg-slate-900 border border-slate-700 text-white p-3 rounded-lg w-full text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="e.g. John"
              {...register('adminFName', { required: true })}
            />
            {errors.adminFName && (
              <span className="text-xs text-rose-400 mt-1 block">First name is required</span>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Last Name *</label>
            <input
              className="bg-slate-900 border border-slate-700 text-white p-3 rounded-lg w-full text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="e.g. Doe"
              {...register('adminLName', { required: true })}
            />
            {errors.adminLName && (
              <span className="text-xs text-rose-400 mt-1 block">Last name is required</span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Email *</label>
          <input
            className="bg-slate-900 border border-slate-700 text-white p-3 rounded-lg w-full text-sm focus:border-emerald-500 focus:outline-none"
            placeholder="e.g. admin@news.org"
            type="email"
            {...register('adminEmail', { required: true })}
          />
          {errors.adminEmail && (
            <span className="text-xs text-rose-400 mt-1 block">Valid email is required</span>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Fact-Checking Session Title *
          </label>
          <input
            className="bg-slate-900 border border-slate-700 text-white p-3 rounded-lg w-full text-sm focus:border-emerald-500 focus:outline-none"
            placeholder="e.g. 2026 Global Election Misinformation Verification"
            {...register('newsdetectionTitle', { required: true })}
          />
          {errors.newsdetectionTitle && (
            <span className="text-xs text-rose-400 mt-1 block">Session title is required</span>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-lg text-sm shadow-lg transition-colors cursor-pointer"
        >
          Initialize & Start Session
        </button>
      </form>
    );
  };

  // ================= EVALUATOR PORTAL =================
  renderEvaluatorPortal = () => {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {!this.state.elStarted && !this.state.elEnded ? (
          <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl text-center shadow-xl">
            <div className="text-4xl mb-3">⏳</div>
            <h2 className="text-xl font-bold text-white mb-2">Evaluation Session Not Initialized</h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto mb-5">
              The administrator has not initialized this round yet. You can still register your profile so you are ready to evaluate news once the session begins.
            </p>
            <Link
              to="/Registration"
              className="inline-block bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2.5 px-6 rounded-lg text-sm transition-colors"
            >
              Go to Evaluator Registration &rarr;
            </Link>
          </div>
        ) : (
          <UserHome el={this.state.elDetails} />
        )}
      </div>
    );
  };
}
