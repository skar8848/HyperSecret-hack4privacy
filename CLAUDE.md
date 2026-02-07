# PrivacyBridge (Aled) - iExec Hackathon

## TL;DR

App de transfert anonyme de USDC sur Arbitrum Sepolia via iExec TEE (SGX/SCONE). L'utilisateur depose USDC dans un vault on-chain, soumet un intent chiffre au TEE. Le TEE genere un wallet frais, redistribue les USDC, et les transfere a la destination. Personne ne peut lier le depot initial a l'adresse finale.

---

## Le Concept

```
1. Alice depose 5 USDC dans PrivacyVault sur Arbitrum Sepolia
2. Alice soumet son intent chiffre au TEE: "envoie a 0xBob"
3. Le TEE (dans l'enclave SGX):
   - Genere un wallet frais 0xFresh42...
   - Appelle redistribute() → 5 USDC vont a 0xFresh42
   - Envoie 0.001 ETH a 0xFresh42 pour le gas
   - 0xFresh42 transfere les USDC a 0xBob
4. Bob recoit 5 USDC
5. On-chain: Vault → 0xFresh42 → 0xBob (impossible de lier a Alice)
```

---

## Architecture

```
User (Arbitrum Sepolia)           iExec TEE (SGX Enclave)
┌──────────────────────┐     ┌────────────────────────────┐
│ 1. Approve USDC      │     │ 3. Decrypt intent           │
│ 2. Deposit to Vault  │────>│ 4. Generate fresh wallet    │
│    + submit intent   │     │ 5. Call redistribute()      │
│    (chiffre via      │     │ 6. Fund fresh wallet ETH    │
│     iExec SDK)       │     │ 7. Transfer USDC → dest     │
└──────────────────────┘     └────────────────────────────┘
```

---

## Adresses Deployees (Arbitrum Sepolia)

| Element | Adresse |
|---------|---------|
| **PrivacyVault** | `0x36f6DcDd2200Fd3d044351A545635AC8F39ee1E7` |
| **iApp (iExec)** | `0x00944931c04C52159F9060dA4C7F0caa73c418Af` |
| **TEE Wallet** | `0xf308D795A3635d443A99B28438936ea9036dD6b5` |
| **Deployer** | `0xF4c09A9121dd457E3947Aa8971AB37ef35e920C2` |
| **USDC (Circle)** | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |
| **Docker Image** | `skar88/iexec-hack:y-tee-scone-5.9.1-v16-prod-00b8578bd425` |

| Config | Valeur |
|--------|--------|
| **Chain** | Arbitrum Sepolia (421614) |
| **RPC** | `https://sepolia-rollup.arbitrum.io/rpc` |
| **iExec Chain** | `arbitrum-sepolia-testnet` |
| **USDC Faucet** | `https://faucet.circle.com/` (20 USDC / 2h) |
| **ETH Faucet** | `https://faucets.chain.link/arbitrum-sepolia` |
| **RLC Faucet** | `https://explorer.iex.ec/arbitrum-sepolia-testnet/faucet` |

---

## Etat du Projet

- [x] PrivacyVault.sol deploye (7/7 tests Hardhat)
- [x] Script standalone TEE teste (4-step flow)
- [x] Fallback server teste E2E
- [x] Frontend E2E test passe (deposit → fallback → transfer)
- [x] iApp deployee sur iExec TEE (arbitrum-sepolia-testnet)
- [x] iApp run reussi sur worker SGX (5 USDC transferes via TEE)
- [x] Frontend mode iExec (default, deploiable sur Vercel)

---

## Structure du Projet

```
privacy-bridge/
├── contracts/                          # Hardhat project
│   ├── contracts/
│   │   ├── PrivacyVault.sol            # Vault (deposit, redistribute, emergencyWithdraw)
│   │   └── MockUSDC.sol                # Mock pour tests locaux
│   ├── scripts/
│   │   ├── deploy.js                   # Deploiement Arb Sepolia
│   │   ├── deposit.js                  # Script utilitaire pour deposer
│   │   └── check-balances.js           # Verifier les balances
│   └── test/
│       └── PrivacyVault.test.js        # 7 tests
│
├── tee-app/
│   ├── standalone/
│   │   └── privacyBridge.js            # Logique TEE standalone (4-step flow)
│   ├── iapp/
│   │   ├── src/
│   │   │   └── app.js                  # iExec iApp entry point
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── iapp.config.json            # Config iapp CLI (gitignored, contient secrets)
│   └── fallback-server/
│       └── server.js                   # Express API fallback
│
├── frontend/                           # React + Vite + wagmi
│   ├── src/
│   │   ├── App.jsx                     # Router + providers
│   │   ├── config/
│   │   │   ├── wagmi.js                # Config chain Arbitrum Sepolia
│   │   │   └── contracts.js            # ABIs + adresses (via env vars)
│   │   └── components/
│   │       ├── BridgeWidget.jsx        # *** COMPOSANT PRINCIPAL ***
│   │       ├── ConnectButton.jsx       # Wallet connect/disconnect
│   │       ├── ElasticSlider.jsx       # Slider anime (gas price)
│   │       ├── Plasma.jsx              # Background WebGL
│   │       ├── StaggeredMenu.jsx       # Menu hamburger anime
│   │       ├── ResourcesPage.jsx       # Page ressources
│   │       ├── TeamPage.jsx            # Page equipe
│   │       └── ProfileCard.jsx         # Carte profil
│   └── .env
│
├── .gitignore
└── CLAUDE.md
```

---

## Smart Contract - PrivacyVault.sol

3 fonctions principales:

1. `deposit(uint256 amount)` — User depose USDC (min 5 USDC). Necessite `approve()` avant.
2. `redistribute(address[] recipients, uint256[] amounts)` — **TEE only** (REDISTRIBUTOR_ROLE). Envoie les USDC du vault vers les wallets frais.
3. `emergencyWithdraw()` — Le user recupere tout son depot si le TEE est down.

Constructeur: `(address _usdc, address _redistributor)`.

---

## TEE Flow (4 etapes)

Le script (`tee-app/standalone/privacyBridge.js` et `tee-app/iapp/src/app.js`):

```
Step 1: Generate fresh wallet (ethers.Wallet.createRandom)
Step 2: Call redistribute() on vault → USDC envoyé au fresh wallet
Step 3: Send 0.001 ETH au fresh wallet (pour le gas)
Step 4: Fresh wallet transfere USDC à la destination
```

L'iApp lit:
- `IEXEC_REQUESTER_SECRET_1`: JSON `{ destination, amount, vaultAddress }`
- `IEXEC_APP_DEVELOPER_SECRET`: TEE wallet private key
- Ecrit `IEXEC_OUT/result.json` + `computed.json`

---

## Frontend

**BridgeWidget.jsx** est le composant principal (~1030 lignes). Il integre tout:

### Flow Bridge (4 etapes visuelles)
1. **Approve USDC** → `usdc.approve(vault, amount)`
2. **Deposit to Vault** → `vault.deposit(amount)`
3. **Submit Intent to TEE** → iExec SDK (push secret, match orders) ou fallback
4. **Anonymous Transfer** → poll task status, fetch result.json depuis IPFS

### Mode iExec (defaut)
Le SDK iExec tourne dans le browser via MetaMask:
- `iexec.secrets.pushRequesterSecret("1", secretJSON)`
- `iexec.orderbook.fetchAppOrderbook(IAPP_ADDRESS)`
- `iexec.order.createRequestorder({ tag: ["tee", "scone"] })`
- `iexec.order.matchOrders()`
- `iexec.task.show(taskId)` pour polling
- `iexec.task.fetchResults(taskId)` + JSZip pour extraire result.json

### Mode Fallback
POST vers `FALLBACK_API/api/process-intent`, poll via `/api/status/:id`.

### Settings Panel
- Execution: iExec TEE (defaut) / Fallback
- Route Priority: Fastest / Best Return
- Gas Price: slider 1-100 gwei

### Deploiement Vercel
Framework: Vite, Root Directory: `frontend`, Output: `dist`
```
VITE_VAULT_ADDRESS=0x36f6DcDd2200Fd3d044351A545635AC8F39ee1E7
VITE_IAPP_ADDRESS=0x00944931c04C52159F9060dA4C7F0caa73c418Af
```

---

## Dependencies Frontend

| Package | Usage |
|---------|-------|
| react ^19 | UI |
| wagmi ^3 + viem ^2 | Wallet + contracts |
| iexec ^8 | iExec SDK (secrets, orders, task tracking) |
| @tanstack/react-query ^5 | Data fetching |
| motion ^12 | Animations |
| gsap ^3 | Menu animations |
| ogl ^1 | WebGL background |
| jszip ^3 | Extraction resultats iExec |

---

## Charte Graphique

| Element | Valeur |
|---------|--------|
| Accent | `#B0F2B6` (vert menthe) |
| Background widget | `rgba(18, 18, 20, 0.92)` + `blur(24px)` |
| Font | Satoshi (variable) |
| Error | `#ff4444` |
| Warning | `#ffb900` |

---

## Points d'Attention

1. **USDC = 6 decimals** — `5 USDC = 5_000_000`, pas `5 * 10^18`
2. **Min 5 USDC** — Le vault exige un minimum de 5 USDC
3. **Fresh wallets need ETH** — Le TEE envoie 0.001 ETH a chaque fresh wallet pour le gas
4. **iExec coute 0.1 RLC par run** — Claim des RLC gratuits sur le faucet
5. **iapp.config.json contient des secrets** — Gitignored, ne jamais commit
6. **Address checksum** — Toujours normaliser avec `ethers.getAddress()` avant utilisation

---

## Stack Technique

| Composant | Tech |
|-----------|------|
| Smart Contract | Solidity 0.8.20, Hardhat, OpenZeppelin 5.x |
| TEE Logic | Node.js, ethers.js v6 |
| iExec TEE | @iexec/iapp CLI, Docker, SGX/SCONE |
| Frontend | React 19, Vite 7, wagmi, viem, iExec SDK |
| Fallback | Express.js |
| Chain | Arbitrum Sepolia |
