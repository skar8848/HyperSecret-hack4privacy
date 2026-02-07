// Quick deposit script: approve + deposit USDC into PrivacyVault
// Usage: npx hardhat run scripts/deposit.js --network arbitrumSepolia
// Set AMOUNT env var to change amount (default 10 USDC)

const hre = require("hardhat");

async function main() {
  const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
  const VAULT_ADDRESS = "0x36f6DcDd2200Fd3d044351A545635AC8F39ee1E7";
  const AMOUNT = process.env.AMOUNT || "10"; // USDC amount

  const [signer] = await hre.ethers.getSigners();
  console.log(`Depositor: ${signer.address}`);

  const usdc = await hre.ethers.getContractAt("IERC20", USDC_ADDRESS, signer);
  const vault = await hre.ethers.getContractAt(
    [
      "function deposit(uint256 amount) external",
      "function deposits(address) external view returns (uint256)",
    ],
    VAULT_ADDRESS,
    signer
  );

  const amountWei = hre.ethers.parseUnits(AMOUNT, 6);

  // Check USDC balance
  const balance = await usdc.balanceOf(signer.address);
  console.log(
    `USDC balance: ${hre.ethers.formatUnits(balance, 6)} USDC`
  );

  if (balance < amountWei) {
    console.error(
      `Not enough USDC! Need ${AMOUNT}, have ${hre.ethers.formatUnits(balance, 6)}`
    );
    console.error("Get testnet USDC from: https://faucet.circle.com/");
    process.exit(1);
  }

  // Approve
  console.log(`\nApproving ${AMOUNT} USDC to vault...`);
  const approveTx = await usdc.approve(VAULT_ADDRESS, amountWei);
  await approveTx.wait();
  console.log(`Approve tx: ${approveTx.hash}`);

  // Deposit
  console.log(`Depositing ${AMOUNT} USDC...`);
  const depositTx = await vault.deposit(amountWei);
  await depositTx.wait();
  console.log(`Deposit tx: ${depositTx.hash}`);

  // Verify
  const deposited = await vault.deposits(signer.address);
  console.log(
    `\nVault deposit for ${signer.address}: ${hre.ethers.formatUnits(deposited, 6)} USDC`
  );
  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
