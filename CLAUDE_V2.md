# PrivacyBridge (Aled) - V2 Frontend Documentation

Ce document couvre toutes les modifications apportees au frontend depuis la V1. Si tu lis le CLAUDE.md original, ce fichier le complete avec les changements d'architecture, les nouveaux composants et le nouveau flow UI.

---

## Changement majeur : Architecture Frontend

### Avant (V1 - CLAUDE.md)
Le frontend avait 3 pages separees :
- `DepositPage.jsx` - Approve + deposit USDC
- `IntentPage.jsx` - Soumettre intent via iExec ou fallback
- `StatusPage.jsx` - Tracker le status

### Maintenant (V2)
**Tout est regroupe dans un seul widget : `BridgeWidget.jsx`**

Le BridgeWidget est un composant monolithique (~900+ lignes) inspire du style LI.FI qui integre les 3 fonctionnalites dans des onglets :
- **Bridge** (onglet principal) - Deposit USDC + soumission d'intent en un flow
- **Track** (onglet secondaire) - Tracker le status d'une execution

Les anciens fichiers (`DepositPage.jsx`, `IntentPage.jsx`, `StatusPage.jsx`) existent encore dans le repo mais **ne sont plus utilises**. Ils peuvent etre supprimes.

---

## Routing

```
/            → BridgeWidget (widget principal)
/resources   → ResourcesPage (page de ressources/liens)
/team        → TeamPage (page equipe avec ProfileCards)
```

Defini dans `App.jsx` avec `react-router-dom` v7.

---

## Nouveaux Composants

### 1. BridgeWidget (`components/BridgeWidget.jsx` + `.css`)

Widget principal qui gere tout le flow :

**Flow Bridge :**
1. L'utilisateur entre un montant USDC et une adresse HL destination
2. Clique "Approve" → appel `usdc.approve(vault, amount)`
3. Attend la confirmation, puis "Deposit" → appel `vault.deposit(amount)`
4. Attend la confirmation, puis soumission de l'intent (iExec ou fallback)
5. Affichage des etapes en temps reel avec spinners

**Flow Track :**
- Mode iExec (poll `task.show`) ou Fallback (poll `/api/status/:id`)
- Affiche les resultats (fresh wallet, redistribute tx, bridge tx, HL transfer)

**Settings Panel (rotule en haut a droite) :**
- **Execution** : choix entre iExec TEE et Fallback (pour demo)
- **Route Priority** : Fastest ou Best Return
- **Gas Price** : slider ElasticSlider (1-100 gwei)
- La rotule fait une rotation de 90 deg avec animation cubic-bezier quand le panel est ouvert

**Emergency Withdraw :**
- Apparait dans un bandeau jaune quand l'utilisateur a un depot actif dans le vault
- Flow inline : bouton "Withdraw" → confirmation "Withdraw all? Yes/No" → spinner → "Withdrawn!" avec auto-reset apres 3s
- Appelle `vault.emergencyWithdraw()`

**States internes importants :**
```
step: "idle" | "approving" | "approved" | "depositing" | "deposited" | "submitting" | "processing" | "done" | "error"
activeTab: "bridge" | "track"
withdrawStep: "idle" | "confirm" | "withdrawing" | "done"
mode: "iexec" | "fallback"
routePriority: "fastest" | "best-return"
gasPrice: number (default 50)
showSettings: boolean
```

### 2. ConnectButton (`components/ConnectButton.jsx` + `.css`)

Bouton de connexion wallet avec :
- **Auto-reconnect detection** : Si le wallet est deja connecte au chargement de la page (session persistante), un dialog de confirmation apparait : "Welcome back - Stay Connected / Disconnect"
- **Manual connect** : Pas de dialog, connexion directe
- **Wallet picker** : Si plusieurs wallets sont detectes, un dropdown permet de choisir

Le mecanisme utilise un `useRef(hasShownConfirm)` + `useState(isManualConnect)` pour distinguer auto-reconnect vs connexion manuelle.

### 3. ElasticSlider (`components/ElasticSlider.jsx` + `.css`)

Slider anime adapte de react-bits :
- **Pas de dependance** chakra-ui ou react-icons (retire)
- Utilise `motion/react` pour les animations spring
- Props : `defaultValue`, `startingValue`, `maxValue`, `isStepped`, `stepSize`, `leftIcon`, `rightIcon`, `onChange`
- Effet elastique quand on depasse les bornes (overflow decay avec sigmoid)
- Hover scale reduit a 1.05 (au lieu de 1.2) pour ne pas deborder

Utilise dans le settings panel pour le gas price.

### 4. Plasma (`components/Plasma.jsx` + `.css`)

Background WebGL shader utilisant OGL. Cree un effet plasma anime en fond de page.
- Props : `color` (#B0F2B6), `speed`, `direction`, `scale`, `opacity`, `mouseInteractive`
- Couleur accent verte du projet

### 5. StaggeredMenu (`components/StaggeredMenu.jsx` + `.css`)

Menu hamburger anime avec GSAP. Navigation vers les pages Resources et Team.
- Animation staggered (decalee) a l'ouverture/fermeture
- Items : Bridge (/), Resources (/resources), Team (/team)

### 6. ProfileCard (`components/ProfileCard.jsx` + `.css`)

Carte de profil pour la page Team. Affiche photo, nom, role, liens sociaux.

### 7. ResourcesPage (`components/ResourcesPage.jsx` + `.css`)

Page de ressources/liens utiles du projet.

### 8. TeamPage (`components/TeamPage.jsx` + `.css`)

Page equipe avec les ProfileCards de chaque membre.

### 9. EarnPage (`components/EarnPage.jsx` + `.css`)

Page earn (staking/yield). **Non utilisee dans le routing actuel** mais le code existe.

### 10. DarkVeil (`components/DarkVeil.jsx` + `.css`)

Overlay sombre. **Non utilise dans le routing actuel.**

---

## Fichiers de Config

### `config/wagmi.js`
- Chain : Arbitrum Sepolia (421614)
- Connector : `injected()` avec `multiInjectedProviderDiscovery: true`
- Transport : HTTP vers `https://sepolia-rollup.arbitrum.io/rpc`

### `config/contracts.js`
- `VAULT_ADDRESS` : lu depuis `VITE_VAULT_ADDRESS` (env) ou `0x0000...`
- `IAPP_ADDRESS` : lu depuis `VITE_IAPP_ADDRESS` (env) ou `0x0000...`
- `FALLBACK_API` : lu depuis `VITE_FALLBACK_API` ou `http://localhost:3001`
- `USDC_ADDRESS` : `0xf3c3351d6bd0098eeb33ca8f830faf2a141ea2e1` (6 decimals)
- ABIs : `VAULT_ABI` (deposit, emergencyWithdraw, deposits, totalDeposited, getBalance)
- ABIs : `ERC20_ABI` (approve, allowance, balanceOf)

---

## Structure des fichiers Frontend (V2)

```
frontend/src/
├── App.jsx                       # Router + providers (wagmi, react-query, BrowserRouter)
├── App.css                       # Layout global, header, footer, background
├── main.jsx                      # Entry point React 19
├── index.css                     # Reset CSS + styles globaux + font Satoshi
├── config/
│   ├── wagmi.js                  # Config chain Arbitrum Sepolia
│   └── contracts.js              # ABIs + adresses (env vars)
└── components/
    ├── BridgeWidget.jsx          # *** COMPOSANT PRINCIPAL *** (deposit + intent + track)
    ├── BridgeWidget.css          # Tous les styles du widget
    ├── ConnectButton.jsx         # Wallet connect/disconnect + auto-reconnect confirm
    ├── ConnectButton.css
    ├── ElasticSlider.jsx         # Slider anime (gas price)
    ├── ElasticSlider.css
    ├── Plasma.jsx                # Background WebGL shader (OGL)
    ├── Plasma.css
    ├── StaggeredMenu.jsx         # Menu hamburger anime (GSAP)
    ├── StaggeredMenu.css
    ├── ResourcesPage.jsx         # Page ressources
    ├── ResourcesPage.css
    ├── TeamPage.jsx              # Page equipe
    ├── TeamPage.css
    ├── ProfileCard.jsx           # Carte profil (utilise dans TeamPage)
    ├── ProfileCard.css
    ├── EarnPage.jsx              # [NON UTILISE] Page earn
    ├── EarnPage.css
    ├── DarkVeil.jsx              # [NON UTILISE] Overlay
    ├── DarkVeil.css
    ├── DepositPage.jsx           # [LEGACY - NON UTILISE] Ancien deposit
    ├── IntentPage.jsx            # [LEGACY - NON UTILISE] Ancien intent
    └── StatusPage.jsx            # [LEGACY - NON UTILISE] Ancien status
```

---

## Dependencies Frontend

| Package | Version | Usage |
|---------|---------|-------|
| react | ^19.2.0 | UI framework |
| react-dom | ^19.2.0 | DOM rendering |
| react-router-dom | ^7.13.0 | Routing (/, /resources, /team) |
| wagmi | ^3.4.2 | Ethereum wallet interactions |
| viem | ^2.45.1 | Contract interactions, parseUnits/formatUnits |
| @tanstack/react-query | ^5.90.20 | Data fetching, cache |
| iexec | ^8.22.5 | iExec SDK (push secret, match orders, task tracking) |
| motion | ^12.33.0 | Animations (ElasticSlider, spring effects) |
| gsap | ^3.14.2 | StaggeredMenu animations |
| ogl | ^1.0.11 | WebGL Plasma background |

Dev : Vite 7, ESLint 9, @vitejs/plugin-react

---

## Charte Graphique

| Element | Valeur |
|---------|--------|
| **Accent principal** | `#B0F2B6` (vert menthe) |
| **Accent hover** | `#c4f7c9` |
| **Background widget** | `rgba(18, 18, 20, 0.92)` + `blur(24px)` |
| **Text primaire** | `#fff` |
| **Text secondaire** | `#8a8a8e` |
| **Text tertiaire** | `#636366` |
| **Text desactive** | `#3a3a3c` |
| **Warning (deposit banner)** | `#ffb900` |
| **Error** | `#ff4444` |
| **Card background** | `rgba(255, 255, 255, 0.04)` |
| **Border** | `rgba(255, 255, 255, 0.06)` |
| **Font** | Satoshi (variable, importe dans index.css) |

---

## Animations CSS

| Animation | Usage | Details |
|-----------|-------|---------|
| `tabFadeIn` | Transition entre onglets Bridge/Track | `opacity 0→1, translateY(6px→0)`, 0.25s ease |
| `confirmFadeIn` | Dialog de confirmation | `opacity 0→1, translateX(4px→0)`, 0.15s ease |
| `routeFadeIn` | Carte de route | `opacity 0→1, translateY(8px→0)`, 0.3s ease |
| `spin` | Spinner de chargement | `rotate(0→360deg)`, 0.8s linear infinite |
| `pulse` | Status badge actif | `opacity 1→0.3→1`, 1.5s ease infinite |
| Gear rotation | Bouton settings | `transform: rotate(90deg)`, 0.4s cubic-bezier |

---

## Variables d'Environnement (.env)

```bash
VITE_VAULT_ADDRESS=0x___   # Adresse du PrivacyVault deploye
VITE_IAPP_ADDRESS=0x___    # Adresse de l'iApp iExec
VITE_FALLBACK_API=http://localhost:3001   # URL du fallback server
```

---

## Comment lancer le frontend

```bash
cd frontend
npm install
npm run dev    # Vite dev server sur http://localhost:5173
```

Pour build :
```bash
npm run build
npm run preview
```

---

## Points d'attention pour les coequipiers

1. **BridgeWidget.jsx est le fichier principal** - Tout le flow deposit/intent/track est dedans. C'est le seul fichier a modifier pour changer le flow principal.

2. **Les adresses sont dans `config/contracts.js`** - Mettez a jour `VAULT_ADDRESS` et `IAPP_ADDRESS` apres deploiement (via `.env` ou directement).

3. **Le mode fallback** fonctionne sans iExec - Utile pour les demos quand le workerpool est lent/down. Il POST vers `FALLBACK_API/api/process-intent`.

4. **USDC = 6 decimals** - Utilisez `parseUnits(amount, 6)` et `formatUnits(balance, 6)`. Jamais 18 decimals.

5. **Min 5 USDC pour HL** - Le bridge Hyperliquid exige minimum 5 USDC. En dessous les fonds sont perdus.

6. **Les fichiers legacy** (`DepositPage.jsx`, `IntentPage.jsx`, `StatusPage.jsx`, `DarkVeil.jsx`, `EarnPage.jsx`) peuvent etre supprimes sans impact.

7. **Le slider de gas** dans les settings est pour l'UX/demo. La valeur `gasPrice` est stockee dans le state du BridgeWidget mais n'est pas encore envoyee au TEE (amelioration future).

8. **Auto-reconnect wallet** - La confirmation "Welcome back" n'apparait que quand le wallet se reconnecte automatiquement au chargement. Pas sur connexion manuelle.
