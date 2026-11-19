# How to Run the Fake News Detection Project
### Synthesizing Blockchain (Ethereum/Truffle) & Natural Language Processing (NLP)

This guide provides clear, step-by-step instructions to set up, configure, deploy, and run the entire project from scratch on your local machine.

---

## 📋 Table of Contents
1. [Architecture Overview](#-architecture-overview)
2. [Prerequisites](#-prerequisites)
3. [Step-by-Step Setup Guide](#-step-by-step-setup-guide)
   - [Step 1: Start Ganache (Local Blockchain)](#step-1-start-ganache-local-blockchain)
   - [Step 2: Configure Truffle Network Settings](#step-2-configure-truffle-network-settings)
   - [Step 3: Compile and Deploy Smart Contracts](#step-3-compile-and-deploy-smart-contracts)
   - [Step 4: Configure MetaMask Wallet](#step-4-configure-metamask-wallet)
   - [Step 5: Install Dependencies and Launch React Web App](#step-5-install-dependencies-and-launch-react-web-app)
4. [User Workflow & Testing Walkthrough](#-user-workflow--testing-walkthrough)
5. [Running the NLP Component (Optional)](#-running-the-nlp-component-optional)
6. [Troubleshooting & Common Issues](#-troubleshooting--common-issues)

---

## 🏛 Architecture Overview

The system consists of three main components:
1. **Ethereum Smart Contract (`contracts/newsDetection.sol`)**: Manages news articles, user registrations, admin verification, voting/evaluation records, and authenticity tallying securely on a local blockchain.
2. **React DApp Frontend (`/app`)**: Web3-enabled web application allowing the Admin to manage news and evaluation rounds, and evaluators to register, cast votes, and view results.
3. **NLP Module (`/NLP`)**: Pre-trained BERT models and Jupyter notebooks for automated textual fake news classification and continuous learning.

---

## 📦 Prerequisites

Ensure you have the following installed on your system:

| Tool | Recommended Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | v16.x or v18.x (LTS) | Runtime for Truffle & React DApp |
| **npm** | v7.x or higher | Package manager |
| **Truffle** | Global (`npm i -g truffle`) | Smart contract compilation & migration |
| **Ganache** | GUI or CLI (`npx ganache`) | Local private Ethereum blockchain |
| **MetaMask** | Browser Extension | Web3 wallet for signing transactions |
| **Python** *(Optional)* | 3.8 – 3.11 | For executing Jupyter notebooks in `/NLP` |

---

## 🚀 Step-by-Step Setup Guide

### Step 1: Start Ganache (Local Blockchain)

You can use either **Ganache CLI** or **Ganache GUI**:

#### Option A: Ganache CLI (Recommended)
Open a new terminal and run:
```bash
npx ganache --port 8545 --chain.networkId 5777
```
*(Keep this terminal window running in the background).*

#### Option B: Ganache GUI
1. Open the **Ganache** desktop app and click **Quickstart Ethereum**.
2. Go to **Settings** (gear icon in top right) -> **Server**.
3. Note the Port number (default is `7545`, or change it to `8545`).
4. Save and restart the workspace.

> **Important**: Note the first two account addresses and their **Private Keys** (click the key icon next to the account in Ganache GUI, or copy from the CLI terminal).
> - **Account 1** will be the **Admin** (deployer).
> - **Account 2** will be the **Evaluator / User**.

---

### Step 2: Configure Truffle Network Settings

Open `truffle-config.js` in the root folder and verify the port matches your Ganache instance:

```javascript
module.exports = {
  contracts_build_directory: path.join(__dirname, "app/src/contracts"),
  networks: {
    development: {
      network_id: "*",
      host: "127.0.0.1",
      port: 8545, // Use 8545 for ganache-cli, or 7545 for Ganache GUI
      gas: 6721975,
      gasPrice: 20000000000,
    },
  },
};
```

---

### Step 3: Compile and Deploy Smart Contracts

In the project root directory (`News_Authenticity_...`):

1. **Install Truffle globally** (if not already installed):
   ```bash
   npm install -g truffle
   ```

2. **Compile the Solidity contracts**:
   ```bash
   truffle compile
   ```

3. **Deploy (migrate) the contracts to Ganache**:
   ```bash
   truffle migrate --reset
   ```

This command automatically generates the updated ABI and contract addresses in `app/src/contracts/newsDetection.json`.

---

### Step 4: Configure MetaMask Wallet

1. **Install the MetaMask extension** in Chrome, Brave, Firefox, or Edge.
2. **Add the Local Ganache Network**:
   - Open MetaMask -> Click the network selector dropdown (top-left) -> **Add network** -> **Add a network manually**.
   - Fill in:
     - **Network Name**: `Ganache Local`
     - **New RPC URL**: `http://127.0.0.1:8545` *(or `http://127.0.0.1:7545` if using GUI)*
     - **Chain ID**: `1337` or `5777` *(MetaMask will show the detected ID if different)*
     - **Currency Symbol**: `ETH`
   - Click **Save**.
3. **Import Test Accounts into MetaMask**:
   - Click your account avatar in MetaMask -> **Import Account**.
   - Paste the **Private Key** of Account 0 from Ganache -> Label it **Admin Account**.
   - Repeat for Account 1 from Ganache -> Label it **Evaluator Account**.

---

### Step 5: Install Dependencies and Launch React Web App

1. Open a new terminal and navigate to the `app` directory:
   ```bash
   cd app
   ```

2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

3. Start the React development server:
   ```bash
   npm start
   ```

   > **Note for Node.js 17+ users**: If you see an error like `digital envelope routines::unsupported`, start the app with:
   > - **Windows (PowerShell)**: `$env:NODE_OPTIONS="--openssl-legacy-provider"; npm start`
   > - **Windows (CMD)**: `set NODE_OPTIONS=--openssl-legacy-provider && npm start`
   > - **Linux / macOS**: `NODE_OPTIONS=--openssl-legacy-provider npm start`

4. The web application will automatically open at:
   ```
   http://localhost:3000
   ```

---

## 🔄 User Workflow & Testing Walkthrough

Follow this sequence to test the entire decentralized verification cycle:

### Phase 1: Admin Setup (Using Admin Account)
1. In MetaMask, switch to the **Admin Account**.
2. Refresh `http://localhost:3000/`.
3. You will see admin navigation options:
   - **Add News** (`/AddNews`): Enter a news headline/statement and click **Submit**. Confirm the MetaMask transaction.
   - You can add multiple news posts to be evaluated.

### Phase 2: Evaluator Registration (Using Evaluator Account)
1. In MetaMask, switch to the **Evaluator Account**.
2. Refresh the browser page.
3. Click **Registration** (`/Registration`).
4. Fill in:
   - Full Name
   - Age
   - Designation / Profession
5. Click **Register** and approve the MetaMask transaction.

### Phase 3: Admin Approval & Start Round
1. In MetaMask, switch back to the **Admin Account**.
2. Go to **Verification** (`/Verification`).
3. You will see the pending evaluator list. Click **Verify** next to the user.
4. Go to **Home** (`/`) or **Start / End** round controls and click **Start Evaluation Round**.

### Phase 4: Voting / Evaluation
1. Switch MetaMask back to the **Evaluator Account**.
2. Go to **Voting** (`/Voting`).
3. View each news item and cast your evaluation (**Authentic / Real** or **Fake**).
4. Confirm each voting transaction via MetaMask.

### Phase 5: Concluding the Round & Viewing Outcomes
1. Switch to **Admin Account** and click **End Evaluation Round**.
2. Go to **Outcomes** (`/Outcomes`) and **Final Outcomes** (`/Final_Outcomes`):
   - Review the recorded consensus, vote percentage, and authenticity determination stored immutable on the blockchain.

---

## 🧠 Running the NLP Component & Continuous Learning Microservice

The system features an automated Python REST microservice (`nlp_server.py`) that bridges the NLP classification and continuous learning models directly to the React DApp:

1. In the project root, start the NLP microservice:
   ```bash
   python nlp_server.py
   ```
   *(Or select Option [5] from `run.bat`)*

2. The server will start on `http://127.0.0.1:5000`:
   - `POST /api/predict`: Real-time news text analysis returning Fake/Authentic classification, confidence %, extracted keywords, and credibility signals.
   - `POST /api/feedback`: Continuous learning endpoint that incrementally updates the model using verified consensus from the blockchain.
   - `GET /api/health`: Health status and total continuous samples assimilated.

3. **Offline Jupyter Notebooks (`/NLP`)**:
   For training experiments or custom BERT runs:
   - `classifying_fake_news_with_bert.ipynb` — PyTorch/Transformers BERT fake news training.
   - `English_Fake_News_Detection.ipynb` — Keras/TensorFlow pipeline.

---

## 🛠 Troubleshooting & Common Issues

### 1. `Nonce too high` or `Transaction Failed` in MetaMask
- **Cause**: Restarting Ganache resets the blockchain nonce to 0, but MetaMask remembers past transactions.
- **Fix**: In MetaMask, go to **Settings** -> **Advanced** -> Click **Clear activity tab data** (or **Reset Account**).

### 2. `Could not connect to your Ethereum client` during `truffle migrate`
- **Cause**: Ganache is not running, or the port in `truffle-config.js` does not match Ganache.
- **Fix**: Check `truffle-config.js`. If Ganache is running on `7545`, set `port: 7545`. If running on `8545`, set `port: 8545`.

### 3. `Contract not deployed to detected network` in Web Browser
- **Cause**: The React app is reading an old `newsDetection.json` contract artifact that doesn't match the current Ganache network ID.
- **Fix**: Run `truffle migrate --reset` in the root folder, then refresh the React browser tab.

### 4. React build fails with OpenSSL digital envelope error
- **Cause**: Node.js v17+ changed OpenSSL cryptographic defaults incompatible with older webpack/react-scripts.
- **Fix**: Run `$env:NODE_OPTIONS="--openssl-legacy-provider"` before running `npm start`.

---

## 📄 IEEE Publication Reference
This implementation is based on the research published in IEEE Access:
- **Title**: Toward News Authenticity: Synthesizing Natural Language Processing and Human Expert Opinion to Evaluate News
- **IEEE Document**: [10034750](https://ieeexplore.ieee.org/document/10034750)
- **DOI**: [10.1109/ACCESS.2023.3241483](https://doi.org/10.1109/ACCESS.2023.3241483)
