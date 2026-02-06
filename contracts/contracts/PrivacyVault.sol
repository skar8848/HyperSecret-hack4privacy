// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PrivacyVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant REDISTRIBUTOR_ROLE = keccak256("REDISTRIBUTOR_ROLE");

    IERC20 public immutable usdc;

    uint256 public totalDeposited;
    mapping(address => uint256) public deposits;

    // 5 USDC minimum (6 decimals)
    uint256 public constant MIN_DEPOSIT = 5 * 10 ** 6;

    event Deposited(address indexed user, uint256 amount);
    event Redistributed(address[] recipients, uint256[] amounts);
    event EmergencyWithdraw(address indexed user, uint256 amount);

    constructor(address _usdc, address _redistributor) {
        usdc = IERC20(_usdc);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REDISTRIBUTOR_ROLE, _redistributor);
    }

    /// @notice Deposit USDC into the privacy vault
    function deposit(uint256 amount) external nonReentrant {
        require(amount >= MIN_DEPOSIT, "Below minimum deposit");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        deposits[msg.sender] += amount;
        totalDeposited += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice TEE-only: redistribute USDC to fresh wallets
    function redistribute(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyRole(REDISTRIBUTOR_ROLE) nonReentrant {
        require(recipients.length == amounts.length, "Length mismatch");
        require(recipients.length > 0, "Empty arrays");

        uint256 total = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Zero address");
            require(amounts[i] > 0, "Zero amount");
            total += amounts[i];
        }

        require(
            usdc.balanceOf(address(this)) >= total,
            "Insufficient vault balance"
        );

        for (uint256 i = 0; i < recipients.length; i++) {
            usdc.safeTransfer(recipients[i], amounts[i]);
        }

        totalDeposited -= total;
        emit Redistributed(recipients, amounts);
    }

    /// @notice Emergency: user reclaims their deposited USDC
    function emergencyWithdraw() external nonReentrant {
        uint256 amount = deposits[msg.sender];
        require(amount > 0, "No deposits");
        deposits[msg.sender] = 0;
        totalDeposited -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit EmergencyWithdraw(msg.sender, amount);
    }

    /// @notice View vault USDC balance
    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
