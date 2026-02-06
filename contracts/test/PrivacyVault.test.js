const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PrivacyVault", function () {
  let vault, usdc, owner, tee, user1, user2;
  const MIN_DEPOSIT = 5n * 10n ** 6n; // 5 USDC

  beforeEach(async function () {
    [owner, tee, user1, user2] = await ethers.getSigners();

    // Deploy mock USDC (6 decimals)
    const MockERC20 = await ethers.getContractFactory("MockUSDC");
    usdc = await MockERC20.deploy();
    await usdc.waitForDeployment();

    // Deploy PrivacyVault
    const PrivacyVault = await ethers.getContractFactory("PrivacyVault");
    vault = await PrivacyVault.deploy(
      await usdc.getAddress(),
      tee.address
    );
    await vault.waitForDeployment();

    // Mint USDC to users
    await usdc.mint(user1.address, 100n * 10n ** 6n); // 100 USDC
    await usdc.mint(user2.address, 100n * 10n ** 6n);
  });

  describe("deposit", function () {
    it("should accept USDC deposits", async function () {
      await usdc.connect(user1).approve(await vault.getAddress(), MIN_DEPOSIT);
      await vault.connect(user1).deposit(MIN_DEPOSIT);

      expect(await vault.deposits(user1.address)).to.equal(MIN_DEPOSIT);
      expect(await vault.totalDeposited()).to.equal(MIN_DEPOSIT);
    });

    it("should reject deposits below minimum", async function () {
      const tooSmall = MIN_DEPOSIT - 1n;
      await usdc.connect(user1).approve(await vault.getAddress(), tooSmall);
      await expect(
        vault.connect(user1).deposit(tooSmall)
      ).to.be.revertedWith("Below minimum deposit");
    });
  });

  describe("redistribute", function () {
    beforeEach(async function () {
      // User deposits 20 USDC
      const amount = 20n * 10n ** 6n;
      await usdc.connect(user1).approve(await vault.getAddress(), amount);
      await vault.connect(user1).deposit(amount);
    });

    it("should allow TEE to redistribute", async function () {
      const freshAddr1 = ethers.Wallet.createRandom().address;
      const freshAddr2 = ethers.Wallet.createRandom().address;

      await vault.connect(tee).redistribute(
        [freshAddr1, freshAddr2],
        [10n * 10n ** 6n, 10n * 10n ** 6n]
      );

      expect(await usdc.balanceOf(freshAddr1)).to.equal(10n * 10n ** 6n);
      expect(await usdc.balanceOf(freshAddr2)).to.equal(10n * 10n ** 6n);
      expect(await vault.totalDeposited()).to.equal(0);
    });

    it("should reject redistribute from non-TEE", async function () {
      const addr = ethers.Wallet.createRandom().address;
      await expect(
        vault.connect(user1).redistribute([addr], [10n * 10n ** 6n])
      ).to.be.reverted;
    });

    it("should reject if insufficient balance", async function () {
      const addr = ethers.Wallet.createRandom().address;
      await expect(
        vault.connect(tee).redistribute([addr], [100n * 10n ** 6n])
      ).to.be.revertedWith("Insufficient vault balance");
    });
  });

  describe("emergencyWithdraw", function () {
    it("should return user deposits", async function () {
      const amount = 20n * 10n ** 6n;
      await usdc.connect(user1).approve(await vault.getAddress(), amount);
      await vault.connect(user1).deposit(amount);

      const balBefore = await usdc.balanceOf(user1.address);
      await vault.connect(user1).emergencyWithdraw();
      const balAfter = await usdc.balanceOf(user1.address);

      expect(balAfter - balBefore).to.equal(amount);
      expect(await vault.deposits(user1.address)).to.equal(0);
    });

    it("should reject if no deposits", async function () {
      await expect(
        vault.connect(user2).emergencyWithdraw()
      ).to.be.revertedWith("No deposits");
    });
  });
});
