const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const USDC_ARB_SEPOLIA = "0xf3c3351d6bd0098eeb33ca8f830faf2a141ea2e1";
  const TEE_REDISTRIBUTOR = process.env.TEE_WALLET_ADDRESS;

  if (!TEE_REDISTRIBUTOR) {
    throw new Error("TEE_WALLET_ADDRESS not set in .env");
  }

  console.log("Deploying PrivacyVault...");
  console.log("  USDC:", USDC_ARB_SEPOLIA);
  console.log("  TEE Redistributor:", TEE_REDISTRIBUTOR);

  const PrivacyVault = await hre.ethers.getContractFactory("PrivacyVault");
  const vault = await PrivacyVault.deploy(USDC_ARB_SEPOLIA, TEE_REDISTRIBUTOR);
  await vault.waitForDeployment();

  const address = await vault.getAddress();
  console.log("\nPrivacyVault deployed to:", address);
  console.log("\nUpdate CLAUDE.md and frontend config with this address!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
