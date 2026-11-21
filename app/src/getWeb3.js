import Web3 from "web3";

let cachedWeb3 = null;

const resolveWeb3 = async (resolve, reject) => {
  if (cachedWeb3) {
    return resolve(cachedWeb3);
  }

  // Modern dapp browsers...
  if (window.ethereum) {
    const web3 = new Web3(window.ethereum);
    try {
      // Check already-connected accounts (does NOT trigger a MetaMask popup)
      let accounts = await window.ethereum.request({ method: "eth_accounts" });

      // Only request accounts if not connected yet
      if (!accounts || accounts.length === 0) {
        try {
          accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        } catch (e) {
          console.warn("User did not grant accounts immediately:", e);
        }
      }

      // Listen for account and network changes
      if (!window.__hasRegisteredEthereumEvents) {
        window.__hasRegisteredEthereumEvents = true;

        window.ethereum.on("accountsChanged", (newAccounts) => {
          cachedWeb3 = null;
          // Clear any manual portal override so the newly selected account decides the portal
          localStorage.removeItem('preferredPortal');
          window.dispatchEvent(new CustomEvent("metamaskAccountChanged", { detail: newAccounts }));
          window.location.reload();
        });

        window.ethereum.on("chainChanged", () => {
          cachedWeb3 = null;
          window.location.reload();
        });
      }

      cachedWeb3 = web3;
      resolve(web3);
    } catch (error) {
      reject(error);
    }
  }
  // Legacy dapp browsers...
  else if (window.web3) {
    const web3 = window.web3;
    console.log("Injected web3 detected.");
    cachedWeb3 = web3;
    resolve(web3);
  }
  // Fallback to localhost...
  else {
    const provider = new Web3.providers.HttpProvider("http://127.0.0.1:8545");
    const web3 = new Web3(provider);
    console.log("No web3 instance injected, using Local web3.");
    cachedWeb3 = web3;
    resolve(web3);
  }
};

const getWeb3 = () =>
  new Promise((resolve, reject) => {
    if (document.readyState === "complete") {
      resolveWeb3(resolve, reject);
    } else {
      window.addEventListener("load", () => {
        resolveWeb3(resolve, reject);
      });
    }
  });

export default getWeb3;
