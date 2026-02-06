# PrivacyBridge - Hackathon iExec TEE

## TL;DR

App de depot anonyme sur Hyperliquid via iExec TEE sur Arbitrum. L'utilisateur depose USDC dans un vault on-chain, soumet un intent chiffre (adresse HL destination) au TEE. Le TEE genere des wallets frais, redistribue, bridge vers HL, et transfere les fonds. Personne ne peut lier le depot initial a l'adresse HL finale.

---

## Le Concept

```
Exemple concret:
1. Alice depose 20 USDC dans PrivacyVault sur Arbitrum Sepolia
2. Alice soumet son intent chiffre au TEE: "envoie a 0xMonAdresseHL"
3. Le TEE (dans l'enclave SGX):
   - Genere un wallet frais 0xFresh42...
   - Appelle redistribute() → 20 USDC vont a 0xFresh42
   - 0xFresh42 envoie les USDC au bridge HL
   - Sur HL, transfere de 0xFresh42 vers 0xMonAdresseHL
4. Alice retrouve ses 20 USDC sur Hyperliquid
5. Personne ne peut prouver le lien Alice → 0xMonAdresseHL
```

---

## Architecture

```
User (Arbitrum Sepolia)           iExec TEE (SGX Enclave)              Hyperliquid Testnet
┌──────────────────────┐     ┌────────────────────────────┐     ┌───────────────────────┐
│ 1. Approve USDC      │     │ 3. Decrypt intent           │     │                       │
│ 2. Deposit to Vault  │────>│ 4. Generate fresh wallet    │     │                       │
│    + submit intent   │     │ 5. Call redistribute()      │     │                       │
│    (chiffre via      │     │ 6. Fund fresh wallet ETH    │     │                       │
│     iExec SDK)       │     │ 7. Bridge USDC → HL         │────>│ 8. USDC credited      │
│                      │     │ 8. usdSend → user HL addr   │────>│    to user's address  │
└──────────────────────┘     └────────────────────────────┘     └───────────────────────┘
```

---

## Etat du Projet

### Ce qui est FAIT (tout le code est ecrit et compile)
- [x] **PrivacyVault.sol** — Contrat Solidity, 7/7 tests Hardhat passing
- [x] **privacyBridge.js** — Script standalone TEE (redistribute → bridge → usdSend HL)
- [x] **iApp wrapper** — Wrapper iExec qui lit IEXEC_REQUESTER_SECRET + IEXEC_APP_DEVELOPER_SECRET
- [x] **Dockerfile** — Pour deployer l'iApp sur iExec
- [x] **Frontend React** — 3 pages (Deposit, Intent, Status) avec wagmi + iExec SDK
- [x] **Fallback server** — Express API si le workerpool iExec est down

### Ce qui RESTE A FAIRE
- [ ] **Deployer PrivacyVault** sur Arbitrum Sepolia
- [ ] **Tester le bridge HL** avec le script standalone
- [ ] **Deployer l'iApp** sur iExec (`iapp deploy`)
- [ ] **Test E2E** complet
- [ ] **Styling frontend** (le code est fonctionnel mais moche)

---

## Structure du Projet

```
privacy-bridge/
├── contracts/                          # Hardhat project
│   ├── contracts/
│   │   ├── PrivacyVault.sol            # Vault principal (deposit, redistribute, emergencyWithdraw)
│   │   └── MockUSDC.sol                # Mock pour tests locaux
│   ├── scripts/
│   │   └── deploy.js                   # Script de deploiement Arb Sepolia
│   ├── test/
│   │   └── PrivacyVault.test.js        # 7 tests
│   ├── hardhat.config.js
│   └── package.json
│
├── tee-app/
│   ├── standalone/
│   │   ├── privacyBridge.js            # Logique TEE complete (testable en CLI)
│   │   └── package.json
│   ├── iapp/
│   │   ├── src/
│   │   │   └── app.js                  # Meme logique wrappee pour iExec
│   │   ├── Dockerfile
│   │   └── package.json
│   └── fallback-server/
│       ├── server.js                   # Express API fallback
│       └── package.json
│
├── frontend/                           # React + Vite + wagmi
│   ├── src/
│   │   ├── App.jsx                     # Router + providers (wagmi, react-query)
│   │   ├── main.jsx
│   │   ├── config/
│   │   │   ├── wagmi.js                # Config chain Arbitrum Sepolia
│   │   │   └── contracts.js            # ABIs + adresses (a mettre a jour apres deploy)
│   │   └── components/
│   │       ├── ConnectButton.jsx       # Wallet connect/disconnect
│   │       ├── DepositPage.jsx         # Approve + deposit USDC dans le vault
│   │       ├── IntentPage.jsx          # Soumettre intent via iExec SDK ou fallback
│   │       └── StatusPage.jsx          # Poller le status + afficher les tx proofs
│   ├── .env.example
│   └── package.json
│
└── CLAUDE.md                           # Ce fichier
```

---

## Adresses & Config Testnet

| Element | Valeur |
|---------|--------|
| **Chain** | Arbitrum Sepolia |
| **Chain ID** | 421614 |
| **RPC** | `https://sepolia-rollup.arbitrum.io/rpc` |
| **USDC** | `0xf3c3351d6bd0098eeb33ca8f830faf2a141ea2e1` (6 decimals) |
| **HL Bridge** | `0x08cfc1B6b2dCF36A1480b99353A354AA8AC56f89` |
| **HL API Testnet** | `https://api.hyperliquid-testnet.xyz` |
| **USDC Faucet** | `https://faucet.circle.com/` (20 USDC / 2h) |
| **ETH Faucet** | `https://faucets.chain.link/arbitrum-sepolia` |
| **HL Faucet** | `https://app.hyperliquid-testnet.xyz/drip` (1000 USDC / 4h, need mainnet account) |

### Adresses deployees (A REMPLIR)
- **PrivacyVault**: `___________________________________`
- **TEE Wallet**: `___________________________________`
- **iApp Address**: `___________________________________`

---

## Comment le Smart Contract marche

**PrivacyVault.sol** — 3 fonctions principales:

1. `deposit(uint256 amount)` — User depose USDC (min 5 USDC). Necessite un `approve()` avant.
2. `redistribute(address[] recipients, uint256[] amounts)` — **TEE only** (REDISTRIBUTOR_ROLE via OpenZeppelin AccessControl). Envoie les USDC du vault vers les wallets frais.
3. `emergencyWithdraw()` — Safety net. Le user recupere tout son depot si le TEE est down.

Le constructeur prend `(address _usdc, address _redistributor)`. Le `_redistributor` est l'adresse du TEE wallet.

---

## Comment le TEE marche

**Le script standalone** (`tee-app/standalone/privacyBridge.js`) fait:

```
Step 1: Generate fresh wallet (ethers.Wallet.createRandom)
Step 2: Call redistribute() on vault → USDC sent to fresh wallet
Step 3: Send 0.001 ETH to fresh wallet (for gas)
Step 4: Fresh wallet calls usdc.transfer(HL_BRIDGE, amount) → bridge to HL
Step 5: Poll HL API until fresh wallet is credited (~60s)
Step 6: Sign EIP-712 usdSend on HL → transfer from fresh wallet to user's HL destination
```

**L'iApp wrapper** (`tee-app/iapp/src/app.js`) fait exactement pareil mais:
- Lit l'intent depuis `IEXEC_REQUESTER_SECRET_1` (env var injectee par iExec)
- Lit la private key TEE depuis `IEXEC_APP_DEVELOPER_SECRET`
- Ecrit le resultat dans `IEXEC_OUT/result.json` + `computed.json`

### HL usdSend — EIP-712 Signing

Le transfer USDC sur Hyperliquid utilise EIP-712 typed data:
- Domain: `{ name: "HyperliquidSignTransaction", version: "1", chainId: 421614 }`
- Type: `HyperliquidTransaction:UsdSend` avec `hyperliquidChain: "Testnet"`
- POST vers `https://api.hyperliquid-testnet.xyz/exchange`
- `signatureChainId: "0x66eee"` (421614 en hex)

---

## Comment le Frontend marche

3 pages React avec wagmi:

1. **DepositPage** — `useWriteContract` pour approve USDC puis deposit dans le vault
2. **IntentPage** — 2 modes:
   - **iExec**: push requester secret → fetch app order + workerpool order → match orders → get taskId
   - **Fallback**: POST vers `http://localhost:3001/api/process-intent`
3. **StatusPage** — Polle le status (iExec task.show ou fallback /api/status/:id) et affiche les tx hashes avec liens Arbiscan

Le fichier `frontend/src/config/contracts.js` contient les ABIs et adresses. **Il faut mettre a jour VAULT_ADDRESS et IAPP_ADDRESS** apres deploiement (via .env ou directement dans le fichier).

---

## Guide de Deploiement Pas a Pas

### Pre-requis
- Node.js >= 18
- Un wallet avec ETH sur Arbitrum Sepolia (faucet: https://faucets.chain.link/arbitrum-sepolia)
- USDC testnet (faucet: https://faucet.circle.com/)
- Un compte Hyperliquid mainnet (pour le faucet testnet)
- Docker (pour l'iApp)

### Etape 1: Installer les deps
```bash
cd privacy-bridge/contracts && npm install
cd ../tee-app/standalone && npm install
cd ../fallback-server && npm install   # npm install express cors ethers dotenv
cd ../../frontend && npm install
```

### Etape 2: Generer le TEE wallet
```bash
cd contracts
node -e "const {Wallet}=require('ethers'); const w=Wallet.createRandom(); console.log('Address:', w.address); console.log('Private Key:', w.privateKey)"
```
**Sauvegarder l'adresse et la private key!** L'adresse sera le REDISTRIBUTOR du vault. Funder cette adresse avec ~0.05 ETH sur Arb Sepolia.

### Etape 3: Deployer le contrat
```bash
cd contracts
# Creer .env:
# DEPLOYER_PRIVATE_KEY=0x_ta_private_key
# TEE_WALLET_ADDRESS=0x_adresse_du_step2
npx hardhat run scripts/deploy.js --network arbitrumSepolia
```
**Noter l'adresse du contrat deploye.**

### Etape 4: Tester le script standalone
```bash
cd tee-app/standalone
# Creer .env:
# TEE_PRIVATE_KEY=0x_private_key_du_step2
# VAULT_ADDRESS=0x_adresse_du_step3

# D'abord un user doit deposer du USDC dans le vault (via frontend ou script)
# Puis:
node privacyBridge.js 0xTON_ADRESSE_HL 5
```

### Etape 5: Deployer l'iApp (iExec)
```bash
npm i -g @iexec/iapp
cd tee-app/iapp
iapp init    # ou configurer manuellement
iapp test    # test local
iapp deploy --chain arbitrum-sepolia-testnet
```
Docs iExec: https://docs.iex.ec/guides/build-iapp/deploy-&-run

### Etape 6: Lancer le frontend
```bash
cd frontend
# Creer .env:
# VITE_VAULT_ADDRESS=0x_adresse_du_step3
# VITE_IAPP_ADDRESS=0x_adresse_du_step5
# VITE_FALLBACK_API=http://localhost:3001
npm run dev
```

### Etape 7 (optionnel): Lancer le fallback server
```bash
cd tee-app/fallback-server
# Le .env est le meme que standalone:
# TEE_PRIVATE_KEY=0x...
# VAULT_ADDRESS=0x...
npm start
# Ecoute sur port 3001
```

---

## Points d'Attention / Gotchas

1. **Min deposit HL = 5 USDC** — En dessous les fonds sont perdus pour toujours
2. **USDC a 6 decimals** — `5 USDC = 5_000_000` en wei, pas `5 * 10^18`
3. **Le bridge HL prend ~60s** — Le script poll toutes les 5s pendant 2.5 min max
4. **Fresh wallets need ETH** — Le TEE envoie 0.001 ETH a chaque fresh wallet pour le gas du bridge
5. **iExec workerpool** — Peut etre lent/down. Le fallback server permet de demo quand meme
6. **EIP-712 HL signing** — Le `signatureChainId` est `"0x66eee"` (421614 hex). Si ca match pas, le usdSend echoue silencieusement
7. **Le contrat track les deposits par user** — C'est un compromis: ca permet emergencyWithdraw mais ca leak un peu de privacy. En prod on pourrait retirer ce mapping.

---

## Stack Technique

| Composant | Tech |
|-----------|------|
| Smart Contract | Solidity 0.8.20, Hardhat, OpenZeppelin 5.x |
| TEE Logic | Node.js, ethers.js v6 |
| iExec TEE | iApp Generator (`@iexec/iapp`), Docker, SGX/TDX |
| Frontend | React 19, Vite, wagmi, viem, @tanstack/react-query, iexec SDK |
| Fallback | Express.js |
| Chain | Arbitrum Sepolia (testnet) |
| Bridge | Hyperliquid Testnet |

---

## Fichiers Cles a Modifier

Si tu dois changer la logique:

| Quoi | Fichier |
|------|---------|
| Logique du vault (deposit/redistribute) | `contracts/contracts/PrivacyVault.sol` |
| Flow TEE (bridge, split, shuffle) | `tee-app/standalone/privacyBridge.js` |
| iApp secrets/outputs | `tee-app/iapp/src/app.js` |
| Adresses deployees | `frontend/src/config/contracts.js` ou `frontend/.env` |
| Config wagmi/chain | `frontend/src/config/wagmi.js` |
| UI deposit | `frontend/src/components/DepositPage.jsx` |
| UI intent submission | `frontend/src/components/IntentPage.jsx` |
| UI status tracking | `frontend/src/components/StatusPage.jsx` |

---

## Ameliorations Possibles (si temps)

- **Batching**: Accumuler plusieurs intents et les traiter ensemble (meilleure privacy)
- **Split & Shuffle**: Au lieu de 1 fresh wallet par user, splitter en N montants differents avec des delays
- **Remove deposit tracking**: Retirer le mapping `deposits` pour plus de privacy (mais perd emergencyWithdraw)
- **Multi-chain**: Supporter d'autres destinations que Hyperliquid
- **Fancier frontend**: Animations, dark mode, progres visuel du bridge
