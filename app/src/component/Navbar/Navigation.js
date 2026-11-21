import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import {
  ChartBarIcon,
  FolderIcon,
  UsersIcon,
  InboxIcon,
  MenuIcon,
  XIcon,
  SearchIcon,
  LogoutIcon,
} from '@heroicons/react/outline';

import getWeb3 from '../../getWeb3';
import ConfirmModal from '../ConfirmModal';

const Navigation = () => {
  const [showSidebar, setShowSidebar] = useState(window.innerWidth >= 768);
  const [activeAccount, setActiveAccount] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    const fetchAccount = async () => {
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

        if (isMounted) setActiveAccount(currentAccount);
      } catch (err) {
        console.error('Navbar account error:', err);
      }
    };

    fetchAccount();

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

  const handleNavClick = () => {
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    sessionStorage.removeItem('portalRole');
    localStorage.removeItem('preferredPortal');
    window.location.href = '/';
  };

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
        <span className="text-sky-400 text-sm font-bold flex items-center gap-1.5">
          <SearchIcon className="h-5 w-5" /> Evaluator Portal
        </span>
        <button
          onClick={handleLogout}
          className="text-[10px] bg-slate-800 text-rose-400 border border-slate-700 px-2 py-1 rounded font-bold"
        >
          Exit ⎋
        </button>
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

        {/* Portal Indicator */}
        <div className="p-3 border-b border-slate-800 bg-sky-950/20">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-xs font-bold text-sky-300 uppercase tracking-wider">
              Evaluator Workspace
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Decentralized fact-checking & consensus voting
          </p>
        </div>

        {/* Evaluator Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {evaluatorNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={'eval-' + item.name}
                to={item.href}
                onClick={handleNavClick}
                className={`flex items-center px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
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
        </nav>

        {/* Account & Logout Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-500">
              Evaluator
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950 text-sky-400 border border-sky-800 truncate max-w-[130px]">
              {sessionStorage.getItem('evaluatorUser') || 'Evaluator'}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-300 truncate">
            {activeAccount
              ? `${activeAccount.substring(0, 10)}...${activeAccount.substring(
                  activeAccount.length - 6
                )}`
              : 'Connecting...'}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-700 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogoutIcon className="h-3.5 w-3.5" />
            <span>Logout / Exit Portal</span>
          </button>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <ConfirmModal
          isOpen={showLogoutConfirm}
          type="warning"
          title="Exit Evaluator Workspace"
          message="Are you sure you want to leave the Evaluator Workspace? You can re-enter anytime from the FactVerify Gateway."
          confirmText="Yes, Exit Workspace"
          cancelText="Stay in Workspace"
          onClose={() => setShowLogoutConfirm(false)}
          onConfirm={confirmLogout}
        />
      )}
    </>
  );
};

export default Navigation;
