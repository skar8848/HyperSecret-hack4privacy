#!/usr/bin/env node

/**
 * PrivacyBridge iExec iApp
 *
 * Runs inside an SGX/TDX enclave via iExec.
 *
 * Inputs:
 *   - IEXEC_REQUESTER_SECRET_1: JSON { hlDestination, amount, vaultAddress }
 *   - IEXEC_APP_DEVELOPER_SECRET: TEE wallet private key
 *
 * Output:
 *   - IEXEC_OUT/result.json: execution proof (tx hashes)
 *   - IEXEC_OUT/computed.json: iExec metadata
 */

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

// --- Config ---
const ARB_SEPOLIA_RPC = "https://sepolia-rollup.arbitrum.io/rpc";
const USDC_ADDRESS = "0xf3c3351d6bd0098eeb33ca8f830faf2a141ea2e1";
const HL_BRIDGE_ADDRESS = "0x08cfc1B6b2dCF36A1480b99353A354AA8AC56f89";
const HL_TESTNET_API = "https://api.hyperliquid-testnet.xyz";

const VAULT_ABI = [
  "function redistribute(address[] recipients, uint256[] amounts) external",
];

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  return await response.json();
}

async function waitForHLCredit(address, expectedAmount, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${HL_TESTNET_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clearinghouseState", user: address }),
      });
      const data = await response.json();
      const balance = parseFloat(data?.marginSummary?.accountValue || "0");
      if (balance >= expectedAmount) return true;
    } catch (e) {
      // retry
    }
    await sleep(5000);
  }
  throw new Error("HL bridge credit timeout");
}

async function main() {
  const iexecOut = process.env.IEXEC_OUT || "/tmp/iexec_out";
  fs.mkdirSync(iexecOut, { recursive: true });

  // Read secrets
  const requesterSecret = process.env.IEXEC_REQUESTER_SECRET_1;
  const teePrivateKey = process.env.IEXEC_APP_DEVELOPER_SECRET;

  if (!requesterSecret) throw new Error("No requester secret (IEXEC_REQUESTER_SECRET_1)");
  if (!teePrivateKey) throw new Error("No app developer secret (IEXEC_APP_DEVELOPER_SECRET)");

  const intent = JSON.parse(requesterSecret);
  const { hlDestination, amount, vaultAddress } = intent;

  if (!hlDestination || !amount || !vaultAddress) {
    throw new Error("Intent must contain hlDestination, amount, vaultAddress");
  }

  console.log(`Processing: ${amount} USDC -> HL ${hlDestination}`);

  const provider = new ethers.JsonRpcProvider(ARB_SEPOLIA_RPC);
  const teeWallet = new ethers.Wallet(teePrivateKey, provider);

  // 1. Generate fresh wallet
  const freshWallet = ethers.Wallet.createRandom().connect(provider);
  console.log(`Fresh wallet: ${freshWallet.address}`);

  // 2. Redistribute USDC from vault to fresh wallet
  const vault = new ethers.Contract(vaultAddress, VAULT_ABI, teeWallet);
  const amountWei = ethers.parseUnits(amount.toString(), 6);
  const tx1 = await vault.redistribute([freshWallet.address], [amountWei]);
  await tx1.wait();
  console.log(`Redistribute tx: ${tx1.hash}`);

  // 3. Fund fresh wallet with ETH
  const tx2 = await teeWallet.sendTransaction({
    to: freshWallet.address,
    value: ethers.parseEther("0.001"),
  });
  await tx2.wait();
  console.log(`ETH funding tx: ${tx2.hash}`);

  // 4. Bridge USDC to HL
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, freshWallet);
  const tx3 = await usdc.transfer(HL_BRIDGE_ADDRESS, amountWei);
  await tx3.wait();
  console.log(`Bridge tx: ${tx3.hash}`);

  // 5. Wait for HL credit
  await waitForHLCredit(freshWallet.address, amount);

  // 6. Transfer on HL to destination
  const hlResult = await hlUsdSend(freshWallet, hlDestination, amount);
  console.log(`HL usdSend:`, JSON.stringify(hlResult));

  // Write result
  const result = {
    success: true,
    freshWallet: freshWallet.address,
    redistributeTx: tx1.hash,
    ethFundingTx: tx2.hash,
    bridgeTx: tx3.hash,
    hlTransfer: hlResult,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(iexecOut, "result.json"),
    JSON.stringify(result, null, 2)
  );

  fs.writeFileSync(
    path.join(iexecOut, "computed.json"),
    JSON.stringify({
      "deterministic-output-path": path.join(iexecOut, "result.json"),
    })
  );

  console.log("iApp execution complete:", JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("iApp error:", err);
  process.exit(1);
});
