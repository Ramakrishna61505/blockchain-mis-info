import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import {
  ChartBarIcon,
  FolderIcon,
  UsersIcon,
  InboxIcon,
  MenuIcon,
  XIcon,
  ShieldCheckIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/outline';

import getWeb3 from '../../getWeb3';
import newsDetection from '../../contracts/newsDetection.json';

const NavigationAdmin = () => {
  const [showSidebar, setShowSidebar] = useState(window.innerWidth >= 768);
  const [activeAccount, setActiveAccount] = useState('');
  const [isContractAdmin, setIsContractAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState(
    localStorage.getItem('preferredPortal') || 'admin'
  );
  const [showAdminLinks, setShowAdminLinks] = useState(true);
  const [showEvaluatorLinks, setShowEvaluatorLinks] = useState(true);

  const location = useLocation();

  // Detect MetaMask Account and Contract Admin
  useEffect(() => {
    let isMounted = true;
    const checkRole = async () => {
      try {
        const web3 = await getWeb3();
        const accounts = await web3.eth.getAccounts();
        if (accounts && accounts[0] && isMounted) {
          setActiveAccount(accounts[0]);
          const networkId = await web3.eth.net.getId();
          const deployedNetwork = newsDetection.networks[networkId];
          if (deployedNetwork && deployedNetwork.address) {
            const instance = new web3.eth.Contract(
              newsDetection.abi,
              deployedNetwork.address
            );
            const adminAddr = await instance.methods.getAdmin().call();
            const isAdmin = accounts[0].toLowerCase() === adminAddr.toLowerCase();
            setIsContractAdmin(isAdmin);
            // If user hasn't explicitly chosen, set based on connected account
            if (!localStorage.getItem('preferredPortal')) {
              setActiveTab(isAdmin ? 'admin' : 'evaluator');
            }
          }
        }
      } catch (err) {
        console.error('Error detecting role in navbar:', err);
      }
    };

    checkRole();

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setShowSidebar(true);
      } else {
        setShowSidebar(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handlePortalSwitch = (portal) => {
    setActiveTab(portal);
    localStorage.setItem('preferredPortal', portal);
    // Broadcast event for Home page synchronization
    window.dispatchEvent(new Event('portalChanged'));
  };

  const handleNavClick = () => {
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  const adminNavigation = [
    { name: 'Admin Dashboard', href: '/', icon: ChartBarIcon },
    { name: 'Add & Manage News', href: '/AddNews', icon: FolderIcon },
    { name: 'Authenticate Evaluators', href: '/Verification', icon: UsersIcon },
    { name: 'Final Outcomes (NLP)', href: '/Final_Outcomes', icon: InboxIcon },
  ];

  const evaluatorNavigation = [
    { name: 'Evaluator Home', href: '/', icon: ChartBarIcon },
    { name: 'Evaluator Registration', href: '/Registration', icon: UsersIcon },
    { name: 'Verify News (Voting)', href: '/Voting', icon: FolderIcon },
    { name: 'Public Outcomes', href: '/Outcomes', icon: InboxIcon },
  ];

  return (
    <>
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 border-b border-slate-800 px-4 py-3 fixed top-0 left-0 right-0 z-30 shadow">
        <button
          onClick={() => setShowSidebar(true)}
          className="text-white p-1 rounded focus:outline-none hover:bg-slate-800"
          aria-label="Open Navigation"
        >
          <MenuIcon className="h-7 w-7 text-sky-400" />
        </button>
        <div className="flex items-center space-x-2">
          {activeTab === 'admin' ? (
            <span className="text-emerald-400 text-sm font-bold flex items-center gap-1">
              <ShieldCheckIcon className="h-5 w-5" /> Admin Portal
            </span>
          ) : (
            <span className="text-sky-400 text-sm font-bold flex items-center gap-1">
              <SearchIcon className="h-5 w-5" /> Evaluator Portal
            </span>
          )}
        </div>
        <div className="w-7" />
      </div>

      {/* Dimmed Backdrop for Mobile Drawer */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-slate-900 border-r border-slate-800 text-white z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          showSidebar ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col shadow-2xl`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <Link
            to="/"
            onClick={handleNavClick}
            className="text-xl font-bold flex items-center text-white hover:text-sky-300 transition-colors"
          >
            <i className="fab fa-hive mr-2 text-sky-400" /> FactVerify
          </Link>
          <button
            onClick={() => setShowSidebar(false)}
            className="md:hidden text-slate-400 hover:text-white p-1 rounded"
            aria-label="Close Navigation"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Portal Switcher Tabs */}
        <div className="p-3 border-b border-slate-800 bg-slate-950/60">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
            Switch Portal View
          </div>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
            <button
              onClick={() => handlePortalSwitch('admin')}
              className={`py-1.5 px-2 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                activeTab === 'admin'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <ShieldCheckIcon className="h-4 w-4" /> Admin
            </button>
            <button
              onClick={() => handlePortalSwitch('evaluator')}
              className={`py-1.5 px-2 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                activeTab === 'evaluator'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <SearchIcon className="h-4 w-4" /> Evaluator
            </button>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Admin Services Section */}
          <div>
            <button
              onClick={() => setShowAdminLinks(!showAdminLinks)}
              className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider px-2 py-1 text-emerald-400 hover:text-emerald-300"
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheckIcon className="h-4 w-4" /> Admin Services
              </span>
              {showAdminLinks ? (
                <ChevronUpIcon className="h-3.5 w-3.5" />
              ) : (
                <ChevronDownIcon className="h-3.5 w-3.5" />
              )}
            </button>

            {showAdminLinks && (
              <div className="mt-1 space-y-1">
                {adminNavigation.map((item) => {
                  const isActive =
                    location.pathname === item.href && activeTab === 'admin';
                  const Icon = item.icon;
                  return (
                    <Link
                      key={'admin-' + item.name}
                      to={item.href}
                      onClick={() => {
                        handlePortalSwitch('admin');
                        handleNavClick();
                      }}
                      className={`flex items-center px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-emerald-600 text-white font-bold shadow'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="mr-2.5 h-4 w-4 text-emerald-400 flex-shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Evaluator Services Section */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              onClick={() => setShowEvaluatorLinks(!showEvaluatorLinks)}
              className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider px-2 py-1 text-sky-400 hover:text-sky-300"
            >
              <span className="flex items-center gap-1.5">
                <SearchIcon className="h-4 w-4" /> Evaluator Services
              </span>
              {showEvaluatorLinks ? (
                <ChevronUpIcon className="h-3.5 w-3.5" />
              ) : (
                <ChevronDownIcon className="h-3.5 w-3.5" />
              )}
            </button>

            {showEvaluatorLinks && (
              <div className="mt-1 space-y-1">
                {evaluatorNavigation.map((item) => {
                  const isActive =
                    location.pathname === item.href && activeTab === 'evaluator';
                  const Icon = item.icon;
                  return (
                    <Link
                      key={'eval-' + item.name}
                      to={item.href}
                      onClick={() => {
                        handlePortalSwitch('evaluator');
                        handleNavClick();
                      }}
                      className={`flex items-center px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-sky-600 text-white font-bold shadow'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="mr-2.5 h-4 w-4 text-sky-400 flex-shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Account Info Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase font-bold text-slate-500">
              MetaMask Role
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isContractAdmin
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                  : 'bg-sky-950 text-sky-400 border border-sky-700'
              }`}
            >
              {isContractAdmin ? 'Admin Account' : 'Evaluator Account'}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-300 truncate">
            {activeAccount
              ? `${activeAccount.substring(0, 8)}...${activeAccount.substring(
                  activeAccount.length - 6
                )}`
              : 'Connecting...'}
          </div>
        </div>
      </aside>
    </>
  );
};

export default NavigationAdmin;
