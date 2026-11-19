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
      portalView: localStorage.getItem('preferredPortal') || 'auto',
    };
  }

  componentDidMount = async () => {
    window.addEventListener('portalChanged', this.handleExternalPortalChange);
    try {
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
        web3: web3,
        newsDetectionInstance: instance,
        account: accounts[0],
      });

      const admin = await this.state.newsDetectionInstance.methods
        .getAdmin()
        .call();
      if (this.state.account && admin && this.state.account.toLowerCase() === admin.toLowerCase()) {
        this.setState({ isAdmin: true });
      }

      // Get newsDetection start and end values
      const start = await this.state.newsDetectionInstance.methods
        .getStart()
        .call();
      this.setState({ elStarted: start });
      const end = await this.state.newsDetectionInstance.methods
        .getEnd()
        .call();
      this.setState({ elEnded: end });

      // Getting newsDetection details from the contract
      const adminName = await this.state.newsDetectionInstance.methods
        .getAdminName()
        .call();
      const adminEmail = await this.state.newsDetectionInstance.methods
        .getAdminEmail()
        .call();
      const newsdetectionTitle = await this.state.newsDetectionInstance.methods
        .getnewsDetectionTitle()
        .call();

      this.setState({
        elDetails: {
          adminName: adminName,
          adminEmail: adminEmail,
          newsdetectionTitle: newsdetectionTitle,
        },
      });
    } catch (error) {
      alert(
        `Failed to load web3, accounts, or contract. Check console for details.`
      );
      console.error(error);
    }
  };

  componentWillUnmount() {
    window.removeEventListener('portalChanged', this.handleExternalPortalChange);
  }

  handleExternalPortalChange = () => {
    const saved = localStorage.getItem('preferredPortal');
    if (saved) {
      this.setState({ portalView: saved });
    }
  };

  setPortalView = (view) => {
    this.setState({ portalView: view });
    localStorage.setItem('preferredPortal', view);
    window.dispatchEvent(new Event('portalChanged'));
  };

  // end newsDetection
  endnewsDetection = async () => {
    try {
      await this.state.newsDetectionInstance.methods
        .endnewsDetection()
        .send({ from: this.state.account, gas: 1000000 });
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to end evaluation session: ' + err.message);
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
      alert('Failed to initialize session: ' + err.message);
    }
  };

  render() {
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

    const effectivePortal =
      this.state.portalView === 'auto'
        ? this.state.isAdmin
          ? 'admin'
          : 'evaluator'
        : this.state.portalView;

    return (
      <div className="md:ml-64 pt-16 md:pt-6 px-4 pb-12 min-h-screen">
        {this.state.isAdmin ? <NavbarAdmin /> : <Navbar />}

        <div className="w-full max-w-4xl mx-auto space-y-4 mb-6">
          {/* User Account & Role Banner */}
          <div className="rounded-xl bg-slate-800/90 border border-slate-700 p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="overflow-hidden">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-0.5">
                Connected MetaMask Wallet
              </span>
              <p className="text-sm font-mono text-emerald-400 break-all font-semibold">
                {this.state.account}
              </p>
            </div>
            <div className="flex-shrink-0">
              {this.state.isAdmin ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-600">
                  <ShieldCheckIcon className="h-4 w-4" />
                  BLOCKCHAIN ADMIN
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-950 text-sky-300 border border-sky-600">
                  <SearchIcon className="h-4 w-4" />
                  EVALUATOR ACCOUNT
                </span>
              )}
            </div>
          </div>

          {/* Interactive Portal Switcher Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-900 border border-slate-800 p-2.5 rounded-xl gap-2 shadow">
            <div className="flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <span>Current View:</span>
              <span className={effectivePortal === 'admin' ? 'text-emerald-400 font-extrabold' : 'text-sky-400 font-extrabold'}>
                {effectivePortal === 'admin' ? '🛡️ Admin Portal' : '🔍 Evaluator Portal'}
              </span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => this.setPortalView('admin')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  effectivePortal === 'admin'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ShieldCheckIcon className="h-4 w-4" /> Admin Portal
              </button>
              <button
                onClick={() => this.setPortalView('evaluator')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  effectivePortal === 'evaluator'
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <SearchIcon className="h-4 w-4" /> Evaluator Portal
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Portal Content */}
        {effectivePortal === 'admin' ? (
          this.renderAdminPortal()
        ) : (
          this.renderEvaluatorPortal()
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
            <div className={`p-6 rounded-2xl border shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              this.state.elStarted && !this.state.elEnded
                ? 'bg-emerald-950/40 border-emerald-600/50'
                : 'bg-slate-800 border-slate-700'
            }`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${
                    this.state.elStarted && !this.state.elEnded ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                  }`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    {this.state.elStarted && !this.state.elEnded ? 'Evaluation Round Active' : 'Evaluation Round Concluded'}
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-extrabold text-white mt-1 capitalize">
                  {this.state.elDetails.newsdetectionTitle || "Fact-Checking Session"}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Admin: <strong className="text-slate-200 capitalize">{this.state.elDetails.adminName}</strong> ({this.state.elDetails.adminEmail})
                </p>
              </div>

              {this.state.elStarted && !this.state.elEnded && (
                <button
                  onClick={this.endnewsDetection}
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
                    Publish headlines or articles to the blockchain for crowd evaluator verification.
                  </p>
                </div>
                <Link
                  to="/AddNews"
                  className="mt-5 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 px-4 rounded-lg text-sm text-center block transition-colors"
                >
                  Manage News &rarr;
                </Link>
              </div>

              <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl flex flex-col justify-between hover:border-emerald-500 transition-all shadow-lg">
                <div>
                  <div className="h-12 w-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-4">
                    <UserGroupIcon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Authenticate Evaluators</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Review and verify evaluator profiles (journalists, fact-checkers) to grant voting rights.
                  </p>
                </div>
                <Link
                  to="/Verification"
                  className="mt-5 w-full bg-sky-600 hover:bg-sky-500 text-white font-medium py-2 px-4 rounded-lg text-sm text-center block transition-colors"
                >
                  Verify Evaluators &rarr;
                </Link>
              </div>

              <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl flex flex-col justify-between hover:border-emerald-500 transition-all shadow-lg">
                <div>
                  <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4">
                    <ChartPieIcon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Final Outcomes (NLP)</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    View final synthesized fact verification outcomes combining human evaluation and continuous NLP.
                  </p>
                </div>
                <Link
                  to="/Final_Outcomes"
                  className="mt-5 w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-2 px-4 rounded-lg text-sm text-center block transition-colors"
                >
                  View Final Outcomes &rarr;
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
              placeholder="e.g. Anisul"
              {...register('adminFName', { required: true })}
            />
            {errors.adminFName && <span className="text-xs text-rose-400 mt-1 block">First name is required</span>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Last Name</label>
            <input
              className="bg-slate-900 border border-slate-700 text-white p-3 rounded-lg w-full text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="e.g. Mahmud"
              {...register('adminLName')}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Admin Email *</label>
          <input
            className="bg-slate-900 border border-slate-700 text-white p-3 rounded-lg w-full text-sm focus:border-emerald-500 focus:outline-none"
            placeholder="e.g. admin@publisher.org"
            {...register('adminEmail', {
              required: 'Email is required',
              pattern: {
                value: /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$/,
                message: 'Invalid email address',
              },
            })}
          />
          {errors.adminEmail && <span className="text-xs text-rose-400 mt-1 block">{errors.adminEmail.message}</span>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">News Detection Title *</label>
          <input
            className="bg-slate-900 border border-slate-700 text-white p-3 rounded-lg w-full text-sm focus:border-emerald-500 focus:outline-none"
            placeholder="e.g. National Fact Verification Round 2026"
            {...register('newsdetectionTitle', { required: true })}
          />
          {errors.newsdetectionTitle && <span className="text-xs text-rose-400 mt-1 block">Session title is required</span>}
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
