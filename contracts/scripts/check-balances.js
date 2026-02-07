const hre = require("hardhat");

async function main() {
  const deployer = "0xF4c09A9121dd457E3947Aa8971AB37ef35e920C2";

  const newUsdc = await hre.ethers.getContractAt("IERC20", "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d");
  const oldUsdc = await hre.ethers.getContractAt("IERC20", "0xf3c3351d6bd0098eeb33ca8f830faf2a141ea2e1");

  const bNew = await newUsdc.balanceOf(deployer);
  const bOld = await oldUsdc.balanceOf(deployer);

  console.log("Deployer USDC (0x75fa... new):", hre.ethers.formatUnits(bNew, 6));
  console.log("Deployer USDC (0xf3c3... old):", hre.ethers.formatUnits(bOld, 6));

  // Check vault USDC address
  const vault = await hre.ethers.getContractAt(
    ["function usdc() view returns (address)"],
    "0xf24009ccB6870fffEd00FeaE69bDED90E8FDEDDD"
  );
  const vaultUsdc = await vault.usdc();
  console.log("Vault configured USDC:", vaultUsdc);
}

main().catch(console.error);
