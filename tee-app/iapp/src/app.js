#!/usr/bin/env node

/**
 * PrivacyBridge iExec iApp
 *
 * Runs inside an SGX/TDX enclave via iExec.
 *
 * Inputs:
 *   - IEXEC_REQUESTER_SECRET_1: JSON { destination, amount, vaultAddress }
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
const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";

const VAULT_ABI = [
  "function redistribute(address[] recipients, uint256[] amounts) external",
];

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
];

async function main() {
  const iexecOut = process.env.IEXEC_OUT || "/tmp/iexec_out";
  fs.mkdirSync(iexecOut, { recursive: true });

  // Read secrets
  const requesterSecret = process.env.IEXEC_REQUESTER_SECRET_1;
  const teePrivateKey = process.env.IEXEC_APP_DEVELOPER_SECRET;

  if (!requesterSecret) throw new Error("No requester secret (IEXEC_REQUESTER_SECRET_1)");
  if (!teePrivateKey) throw new Error("No app developer secret (IEXEC_APP_DEVELOPER_SECRET)");

  const intent = JSON.parse(requesterSecret);
  const { destination, amount, vaultAddress } = intent;

  if (!destination || !amount || !vaultAddress) {
    throw new Error("Intent must contain destination, amount, vaultAddress");
  }

  console.log(`Processing: ${amount} USDC -> ${destination}`);

  const provider = new ethers.JsonRpcProvider(ARB_SEPOLIA_RPC);
  const teeWallet = new ethers.Wallet(teePrivateKey, provider);
  const normalizedDest = ethers.getAddress(destination);

  // 1. Generate fresh wallet
  const freshWallet = ethers.Wallet.createRandom().connect(provider);
  console.log(`Fresh wallet: ${freshWallet.address}`);

  // 2. Redistribute USDC from vault to fresh wallet
  const vault = new ethers.Contract(vaultAddress, VAULT_ABI, teeWallet);
  const amountWei = ethers.parseUnits(amount.toString(), 6);
  const tx1 = await vault.redistribute([freshWallet.address], [amountWei]);
  await tx1.wait();
  console.log(`Redistribute tx: ${tx1.hash}`);

  // 3. Fund fresh wallet with ETH for gas
  const tx2 = await teeWallet.sendTransaction({
    to: freshWallet.address,
    value: ethers.parseEther("0.001"),
  });
  await tx2.wait();
  console.log(`ETH funding tx: ${tx2.hash}`);

  // 4. Transfer USDC from fresh wallet to destination (anonymous transfer)
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, freshWallet);
  const tx3 = await usdc.transfer(normalizedDest, amountWei);
  await tx3.wait();
  console.log(`Transfer tx: ${tx3.hash}`);

  // Write result
  const result = {
    success: true,
    freshWallet: freshWallet.address,
    redistributeTx: tx1.hash,
    ethFundingTx: tx2.hash,
    transferTx: tx3.hash,
    destination: normalizedDest,
    amount: amount,
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
