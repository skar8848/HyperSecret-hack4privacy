const { ethers } = require("ethers");

// --- Config ---
const ARB_SEPOLIA_RPC = "https://sepolia-rollup.arbitrum.io/rpc";
const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
const HL_BRIDGE_ADDRESS = "0x08cfc1B6b2dCF36A1480b99353A354AA8AC56f89";
const HL_TESTNET_API = "https://api.hyperliquid-testnet.xyz";
// USDC2 is the token HL bridge actually accepts on Arb Sepolia
const USDC2_ADDRESS = "0x1baAbB04529D43a73232B713C0FE471f7c7334d5";

// --- ABIs ---
const VAULT_ABI = [
  "function redistribute(address[] recipients, uint256[] amounts) external",
  "function getBalance() external view returns (uint256)",
];

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sign and send a usdSend action on Hyperliquid testnet.
 * Transfers USDC from one HL account to another.
 */
async function hlUsdSend(wallet, destination, amountUsd) {
  const timestamp = Date.now();

  const domain = {
    name: "HyperliquidSignTransaction",
    version: "1",
    chainId: 421614,
    verifyingContract: "0x0000000000000000000000000000000000000000",
  };

  const types = {
    "HyperliquidTransaction:UsdSend": [
      { name: "hyperliquidChain", type: "string" },
      { name: "destination", type: "string" },
      { name: "amount", type: "string" },
      { name: "time", type: "uint64" },
    ],
  };

  const message = {
    hyperliquidChain: "Testnet",
    destination: destination,
    amount: amountUsd.toString(),
    time: timestamp,
  };

  const signature = await wallet.signTypedData(domain, types, message);
  const { r, s, v } = ethers.Signature.from(signature);

  const payload = {
    action: {
      type: "usdSend",
      hyperliquidChain: "Testnet",
      signatureChainId: "0x66eee",
      destination: destination,
      amount: amountUsd.toString(),
      time: timestamp,
    },
    nonce: timestamp,
    signature: { r, s, v },
  };

  const response = await fetch(`${HL_TESTNET_API}/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  return result;
}

/**
 * Poll HL testnet to check if a wallet has been credited after bridge.
 */
async function waitForHLCredit(address, expectedAmount, maxRetries = 30) {
  console.log(
    `  Waiting for HL credit of $${expectedAmount} to ${address}...`
  );

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${HL_TESTNET_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "clearinghouseState",
          user: address,
        }),
      });

      const data = await response.json();
      const balance = parseFloat(data?.marginSummary?.accountValue || "0");

      if (balance >= expectedAmount) {
        console.log(`  HL credited! Balance: $${balance}`);
        return true;
      }

      console.log(
        `  Attempt ${i + 1}/${maxRetries}: balance=$${balance}, waiting...`
      );
    } catch (e) {
      console.log(`  Attempt ${i + 1}/${maxRetries}: error polling HL`);
    }

    await sleep(5000);
  }

  throw new Error("HL bridge credit timeout after " + maxRetries * 5 + "s");
}

/**
 * Main execution pipeline.
 * This runs inside the TEE in production (iExec iApp).
 *
 * The flow breaks the on-chain link between depositor and recipient:
 * 1. TEE generates a fresh random wallet (untraceable)
 * 2. Vault redistributes USDC to fresh wallet (TEE-authorized)
 * 3. Fresh wallet sends USDC to user's destination address
 *
 * An on-chain observer sees: Vault → FreshWallet → Destination
 * but CANNOT link it back to the original depositor.
 */
async function execute(teePrivateKey, vaultAddress, hlDestination, amountUsdc) {
  // Normalize address checksum
  hlDestination = ethers.getAddress(hlDestination);

  console.log("\n=== PrivacyBridge TEE Execution ===");
  console.log(`  Destination: ${hlDestination}`);
  console.log(`  Amount: ${amountUsdc} USDC`);

  const provider = new ethers.JsonRpcProvider(ARB_SEPOLIA_RPC);
  const teeWallet = new ethers.Wallet(teePrivateKey, provider);
  console.log(`  TEE Wallet: ${teeWallet.address}`);

  // Step 1: Generate fresh wallet
  const freshWallet = ethers.Wallet.createRandom().connect(provider);
  console.log(`\n[1/4] Fresh wallet generated: ${freshWallet.address}`);

  // Step 2: Call redistribute() on PrivacyVault
  const vault = new ethers.Contract(vaultAddress, VAULT_ABI, teeWallet);
  const amountWei = ethers.parseUnits(amountUsdc.toString(), 6);

  console.log(`\n[2/4] Calling redistribute()...`);
  const tx1 = await vault.redistribute([freshWallet.address], [amountWei]);
  const receipt1 = await tx1.wait();
  console.log(`  Redistribute tx: ${tx1.hash} (block ${receipt1.blockNumber})`);

  // Step 3: Send ETH to fresh wallet for gas
  console.log(`\n[3/4] Funding fresh wallet with ETH for gas...`);
  const ethForGas = ethers.parseEther("0.001");
  const tx2 = await teeWallet.sendTransaction({
    to: freshWallet.address,
    value: ethForGas,
  });
  await tx2.wait();
  console.log(`  ETH funding tx: ${tx2.hash}`);

  // Verify fresh wallet has USDC
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, freshWallet);
  const freshBalance = await usdc.balanceOf(freshWallet.address);
  console.log(
    `  Fresh wallet USDC: ${ethers.formatUnits(freshBalance, 6)} USDC`
  );

  // Step 4: Transfer USDC from fresh wallet to destination
  // This breaks the on-chain link: observer sees Vault → Fresh → Destination
  // but cannot link it to the original depositor
  console.log(`\n[4/4] Sending USDC to destination ${hlDestination}...`);
  const tx3 = await usdc.transfer(hlDestination, amountWei);
  const receipt3 = await tx3.wait();
  console.log(`  Transfer tx: ${tx3.hash} (block ${receipt3.blockNumber})`);

  const result = {
    success: true,
    freshWallet: freshWallet.address,
    redistributeTx: tx1.hash,
    ethFundingTx: tx2.hash,
    transferTx: tx3.hash,
    destination: hlDestination,
    amount: amountUsdc,
    timestamp: new Date().toISOString(),
  };

  console.log("\n=== Execution Complete ===");
  console.log(JSON.stringify(result, null, 2));

  return result;
}

// --- CLI entry point ---
if (require.main === module) {
  require("dotenv").config();

  const teeKey = process.env.TEE_PRIVATE_KEY;
  const vaultAddr = process.env.VAULT_ADDRESS;

  // Parse CLI args: node privacyBridge.js <destination> <amount>
  const dest = process.argv[2];
  const amount = parseFloat(process.argv[3] || "5");

  if (!teeKey || !vaultAddr || !dest) {
    console.error(
      "Usage: node privacyBridge.js <destinationAddress> <amountUSDC>"
    );
    console.error("Required env: TEE_PRIVATE_KEY, VAULT_ADDRESS");
    process.exit(1);
  }

  execute(teeKey, vaultAddr, dest, amount).catch((err) => {
    console.error("Execution failed:", err);
    process.exit(1);
  });
}

module.exports = { execute, hlUsdSend, waitForHLCredit };
