// Node modules
import React, { Component } from 'react';
import { Link } from 'react-router-dom';

// Components
import Navbar from '../Navbar/Navigation';
import NavbarAdmin from '../Navbar/NavigationAdmin';
import ConfirmModal from '../ConfirmModal';

// CSS
import './Registration.css';

// Contract
import getWeb3 from '../../getWeb3';
import newsDetection from '../../contracts/newsDetection.json';

export default class Registration extends Component {
  constructor(props) {
    super(props);
    this.state = {
      newsDetectionInstance: undefined,
      web3: null,
      account: null,
      isAdmin: false,
      isElStarted: false,
      isElEnded: false,
      evaluatorCount: undefined,
      evaluatorName: '',
      evaluatorIdn: '',
      evaluatorProfession: '',
      evaluators: [],
      currentEvaluator: {
        address: undefined,
        name: null,
        idn: null,
        profession:null,
        hasVoted: false,
        isVerified: false,
        isRegistered: false,
      },
      confirmModal: null,
    };
  }

  componentDidMount = async () => {
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

      // Set web3, accounts, and contract to the state, and then proceed with an
      // example of interacting with the contract's methods.
      this.setState({
        web3: web3,
        newsDetectionInstance: instance,
        account: accounts[0],
      });

      // Admin account and verification
      const admin = await instance.methods.getAdmin().call();
      if (accounts[0] && admin && accounts[0].toLowerCase() === admin.toLowerCase()) {
        this.setState({ isAdmin: true });
      }

      // Get start and end values
      const start = await this.state.newsDetectionInstance.methods
        .getStart()
        .call();
      this.setState({ isElStarted: start });
      const end = await this.state.newsDetectionInstance.methods
        .getEnd()
        .call();
      this.setState({ isElEnded: end });

      // Total number of evaluators
      const evaluatorCount = await this.state.newsDetectionInstance.methods
        .getTotalEvaluator()
        .call();
      this.setState({ evaluatorCount: evaluatorCount });

      // Loading all the evaluators
      for (let i = 0; i < this.state.evaluatorCount; i++) {
        const evaluatorAddress = await this.state.newsDetectionInstance.methods
          .evaluators(i)
          .call();
        const evaluator = await this.state.newsDetectionInstance.methods
          .evaluatorDetails(evaluatorAddress)
          .call();
        this.state.evaluators.push({
          address: evaluator.evaluatorAddress,
          name: evaluator.name,
          idn: evaluator.idn,
          profession: evaluator.profession,
          hasVoted: evaluator.hasVoted,
          isVerified: evaluator.isVerified,
          isRegistered: evaluator.isRegistered,
        });
      }
      this.setState({ evaluators: this.state.evaluators });

      // Loading current evaluators
      const evaluator = await this.state.newsDetectionInstance.methods
        .evaluatorDetails(this.state.account)
        .call();
      this.setState({
        currentEvaluator: {
          address: evaluator.evaluatorAddress,
          name: evaluator.name,
          idn: evaluator.idn,
          profession: evaluator.profession,
          hasVoted: evaluator.hasVoted,
          isVerified: evaluator.isVerified,
          isRegistered: evaluator.isRegistered,
        },
      });
    } catch (error) {
      // Catch any errors for any of the above operations.
      console.error(error);
      this.openAlertModal(
        "Connection Error",
        "Failed to load web3, accounts, or contract. Check console for details.",
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

  switchMetaMaskAccount = async () => {
    try {
      if (window.ethereum) {
        await window.ethereum.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        });
        window.location.reload();
      } else {
        this.openAlertModal("MetaMask Not Detected", "Please install or unlock the MetaMask browser extension.", "warning");
      }
    } catch (err) {
      console.error("Account switch error:", err);
    }
  };

  updateEvaluatorName = (event) => {
    this.setState({ evaluatorName: event.target.value });
  };
  updateEvaluatorIdn = (event) => {
    this.setState({ evaluatorIdn: event.target.value });
  };
  updateEvaluatorProfession = (event) => {
    this.setState({ evaluatorProfession: event.target.value });
  };  

  promptRegister = (event) => {
    if (event && event.preventDefault) {
      event.preventDefault();
    }
    const { evaluatorName, evaluatorIdn, evaluatorProfession, account } = this.state;
    if (!evaluatorName || !evaluatorIdn) {
      this.openAlertModal("Required Information Missing", "Please provide both your Name and ID number to register.", "warning");
      return;
    }

    this.setState({
      confirmModal: {
        isOpen: true,
        type: 'confirm',
        title: 'Register Evaluator Identity',
        message: `You are about to register on the blockchain as: ${evaluatorName} (${evaluatorProfession || 'Fact-Checker'}), ID: ${evaluatorIdn}. Address: ${account}. An admin will authenticate your profile before you can submit evaluation votes.`,
        confirmText: 'Sign & Register on Chain',
        cancelText: 'Cancel',
        isProcessing: false,
        onClose: () => this.setState({ confirmModal: null }),
        onConfirm: this.registerAsEvaluator,
      },
    });
  };

  registerAsEvaluator = async () => {
    const { evaluatorName, evaluatorIdn, evaluatorProfession, account, newsDetectionInstance } = this.state;

    this.setState((prev) => ({
      confirmModal: prev.confirmModal
        ? { ...prev.confirmModal, isProcessing: true, processingText: 'Signing registration in MetaMask...' }
        : null,
    }));

    try {
      await newsDetectionInstance.methods
        .registerAsEvaluator(
          evaluatorName,
          String(evaluatorIdn),
          evaluatorProfession || "Evaluator"
        )
        .send({ from: account, gas: 1000000 });

      this.setState({ confirmModal: null });
      window.location.reload();
    } catch (error) {
      console.error("Registration error:", error);
      this.setState({ confirmModal: null });
      this.openAlertModal(
        "Registration Cancelled",
        error.message?.includes("User denied")
          ? "You rejected the transaction in MetaMask."
          : `Failed to register evaluator on blockchain: ${error.message || "Unknown error"}`,
        "warning"
      );
    }
  };
  render() {
    const isPortalAdmin = sessionStorage.getItem('portalRole') === 'admin';

    if (!this.state.web3) {
      return (
        <>
          {isPortalAdmin ? <NavbarAdmin /> : <Navbar />}
          <center>Loading Web3, accounts, and contract...</center>
        </>
      );
    }
    return (
      <div className="md:ml-64 pt-16 md:pt-6 px-4 pb-12 min-h-screen">
        {isPortalAdmin ? <NavbarAdmin /> : <Navbar />}
        <div className="w-full max-w-4xl mx-auto space-y-6">
          {this.state.isAdmin && (
            <div className="bg-emerald-950/50 border border-emerald-600/60 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
              <div>
                <p className="text-emerald-300 font-semibold text-sm">🛡️ You are connected as Administrator</p>
                <p className="text-slate-400 text-xs">Evaluators use this form to register their profiles. To verify registered evaluators, go to Authenticate Evaluators.</p>
              </div>
              <Link
                to="/Verification"
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded-lg flex-shrink-0 transition-colors"
              >
                Go to Authenticate Evaluators &rarr;
              </Link>
            </div>
          )}
          <div>
            <div className="container-item bg-slate-700 text-sky-400">
              <p className="font-medium">Total registered evaluators: {this.state.evaluators.length}</p>
            </div>
          <div className="container-main">
            <h3 className="text-2xl text-white font-bold">Registration</h3>
            <small className="text-slate-400">Register to evaluate news authenticity.</small>
            <div className="container-item bg-slate-800 mt-4">
              <form className="w-full max-w-xl">
                <div className="div-li w-full mb-4">
                  <div className="flex items-center justify-between">
                    <label className="label-r text-white">Account Address</label>
                    <button
                      type="button"
                      onClick={this.switchMetaMaskAccount}
                      className="text-xs bg-sky-600 hover:bg-sky-500 text-white font-medium py-1 px-3 rounded-lg transition-colors flex items-center gap-1 shadow"
                    >
                      🦊 Switch Account in MetaMask
                    </button>
                  </div>
                  <input
                    className="bg-slate-900 border border-slate-700 shadow-md rounded p-3 block mt-2 w-full text-slate-300 text-sm font-mono"
                    type="text"
                    value={this.state.account || ''}
                    readOnly
                  />
                  {this.state.isAdmin && (
                    <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <span>⚠ You are connected with the <strong>Admin Account</strong>. Admins manage news and verify evaluators. Switch in MetaMask to register as an Evaluator.</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={this.switchMetaMaskAccount}
                          className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-1 px-2.5 rounded text-[11px] whitespace-nowrap"
                        >
                          Switch Wallet
                        </button>
                        <Link
                          to="/"
                          className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-1 px-2.5 rounded text-[11px] whitespace-nowrap"
                        >
                          Admin Portal &rarr;
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
                  <div className="div-li">
                    <label className={'label-r text-white'}>
                      Name
                      <input
                        className="bg-slate-900 shadow-md rounded p-5 block mt-2 w-full"
                        type="text"
                        placeholder="eg. Anis"
                        value={this.state.evaluatorName}
                        onChange={this.updateEvaluatorName}
                      />{' '}
                    </label>
                  </div>
                  <div className="div-li">
                    <label className={'label-r text-white'}>
                      Profession
                      <input
                        className="bg-slate-900 shadow-md rounded p-5 block mt-2 w-full"
                        type="text"
                        placeholder="eg. journalist"
                        value={this.state.evaluatorProfession}
                        onChange={this.updateEvaluatorProfession}
                      />{' '}
                    </label>
                  </div>
                  <div className="div-li">
                    <label className={'label-r text-white'}>
                      ID <span style={{ color: 'tomato' }}>*</span>
                      <input
                        className="bg-slate-900 shadow-md rounded p-5 block mt-2 w-full"
                        type="text"
                        placeholder="eg. 192130"
                        value={this.state.evaluatorIdn}
                        onChange={this.updateEvaluatorIdn}
                      />
                    </label>
                  </div>

                  <p className="note">
                    <span style={{ color: 'tomato' }}> Note: </span>
                    <br />{' '}
                    <span className="text-sky-600">
                      Enter your Account address, Name, Profession, and ID.
                    </span>
                  </p>
                  {this.state.currentEvaluator.isVerified && (
                    <p className="text-emerald-400 mt-2 font-semibold">
                      ✓ This account is already verified by Admin.
                    </p>
                  )}
                  <button
                    type="button"
                    className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-2.5 px-6 mt-5 rounded-xl cursor-pointer disabled:opacity-50 transition-all shadow-lg"
                    disabled={
                      !this.state.evaluatorName ||
                      !this.state.evaluatorIdn ||
                      this.state.currentEvaluator.isVerified
                    }
                    onClick={this.promptRegister}
                  >
                    {this.state.currentEvaluator.isRegistered
                      ? 'Update Registration'
                      : 'Register Profile on Chain'}
                  </button>
                </form>
              </div>
            </div>
            <div
              className="container-main"
              style={{
                borderTop: this.state.currentEvaluator.isRegistered
                  ? null
                  : '1px solid',
              }}
            >
              {loadCurrentEvaluator(
                this.state.currentEvaluator,
                this.state.currentEvaluator.isRegistered
              )}
            </div>
            {this.state.isAdmin ? (
              <div
                className="container-main"
                style={{ borderTop: '1px solid' }}
              >
                <small>TotalEvaluators: {this.state.evaluators.length}</small>
                {loadAllEvaluators(this.state.evaluators)}
              </div>
            ) : null}
          </div>
        </div>

        {/* Custom Animated Modal */}
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
            onClose={this.state.confirmModal.onClose || (() => this.setState({ confirmModal: null }))}
            onConfirm={this.state.confirmModal.onConfirm}
          />
        )}
      </div>
    );
  }
}
export function loadCurrentEvaluator(evaluator, isRegistered) {
  return (
    <>
      <div className={'container-item bg-sky-600'}>
        <center className="text-white font-semibold text-lg">
          Your Registered Info
        </center>
      </div>
      <div className={'container-list bg-slate-900 text-sky-600'}>
        <table className="overflow-scroll">
          <tr>
            <th>Your Account Address :</th>
            <td>{evaluator.address}</td>
          </tr>
          <tr>
            <th>Your Name :</th>
            <td>{evaluator.name}</td>
          </tr>
          <tr>
          <th>Your Profession :</th>
          <td>{evaluator.profession}</td>
        </tr>
          <tr>
            <th>Your Id :</th>
            <td>{evaluator.idn}</td>
          </tr>
          <tr>
            <th>Verify news: </th>
            <td>{evaluator.hasVoted ? 'True' : 'False'}</td>
          </tr>
          <tr>
            <th>Verified by News Publisher: </th>
            <td>{evaluator.isVerified ? 'True' : 'False'}</td>
          </tr>
          <tr>
            <th>Registered</th>
            <td>{evaluator.isRegistered ? 'True' : 'False'}</td>
          </tr>
        </table>
      </div>
    </>
  );
}
export function loadAllEvaluators(evaluators) {
  const renderAllEvaluators = (evaluator) => {
    return (
      <>
        <div className="container-list bg-slate-900 text-sky-600">
          <table>
            <tr>
              <th>Account address</th>
              <td>{evaluator.address}</td>
            </tr>
            <tr>
              <th>Name</th>
              <td>{evaluator.name}</td>
            </tr>
            <tr>
            <th>Profession</th>
            <td>{evaluator.profession}</td>
          </tr>
            <tr>
              <th>ID</th>
              <td>{evaluator.idn}</td>
            </tr>
            <tr>
              <th>Verify news</th>
              <td>{evaluator.hasVoted ? 'True' : 'False'}</td>
            </tr>
            <tr>
              <th>Verified by News Publisher</th>
              <td>{evaluator.isVerified ? 'True' : 'False'}</td>
            </tr>
            <tr>
              <th>Registered</th>
              <td>{evaluator.isRegistered ? 'True' : 'False'}</td>
            </tr>
          </table>
        </div>
      </>
    );
  };
  return (
    <>
      <div className="container-item bg-sky-600 text-white font-semibold text-lg">
        <center>List of evaluators</center>
      </div>
      {evaluators.map(renderAllEvaluators)}
    </>
  );
}
