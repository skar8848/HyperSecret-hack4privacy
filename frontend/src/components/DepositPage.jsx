import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import {
  VAULT_ADDRESS,
  USDC_ADDRESS,
  VAULT_ABI,
  ERC20_ABI,
} from "../config/contracts";

export default function DepositPage() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState("input"); // input | approving | depositing | done

  // Read USDC balance
  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read existing deposit in vault
  const { data: existingDeposit, refetch: refetchDeposit } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "deposits",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read vault total
  const { data: vaultTotal } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "totalDeposited",
  });

  // Approve tx
  const {
    writeContract: approve,
    data: approveTxHash,
    isPending: isApproving,
    error: approveError,
  } = useWriteContract();

  // Deposit tx
  const {
    writeContract: deposit,
    data: depositTxHash,
    isPending: isDepositing,
    error: depositError,
  } = useWriteContract();

  // Emergency withdraw tx
  const {
    writeContract: emergencyWithdraw,
    data: withdrawTxHash,
    isPending: isWithdrawing,
  } = useWriteContract();

  // Wait for receipts
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });
  const { isSuccess: depositConfirmed } = useWaitForTransactionReceipt({
    hash: depositTxHash,
  });
  const { isSuccess: withdrawConfirmed } = useWaitForTransactionReceipt({
    hash: withdrawTxHash,
  });

  // After approve confirms, trigger deposit
  useEffect(() => {
    if (approveConfirmed && step === "approving") {
      const amountWei = parseUnits(amount, 6);
      deposit({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "deposit",
        args: [amountWei],
      });
      setStep("depositing");
    }
  }, [approveConfirmed]);

  // After deposit confirms
  useEffect(() => {
    if (depositConfirmed) {
      setStep("done");
      refetchBalance();
      refetchDeposit();
    }
  }, [depositConfirmed]);

  // After withdraw confirms
  useEffect(() => {
    if (withdrawConfirmed) {
      refetchBalance();
      refetchDeposit();
    }
  }, [withdrawConfirmed]);

  const handleDeposit = () => {
    if (!amount || parseFloat(amount) < 5) return;
    const amountWei = parseUnits(amount, 6);
    approve({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [VAULT_ADDRESS, amountWei],
    });
    setStep("approving");
  };

  const handleEmergencyWithdraw = () => {
    emergencyWithdraw({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "emergencyWithdraw",
    });
  };

  if (!isConnected) {
    return <div>Connect your wallet to deposit USDC.</div>;
  }

  return (
    <div>
      <h2>Deposit USDC</h2>

      <div style={{ marginBottom: "16px" }}>
        <p>
          USDC Balance:{" "}
          {usdcBalance !== undefined
            ? formatUnits(usdcBalance, 6)
            : "..."}{" "}
          USDC
        </p>
        <p>
          Your Vault Deposit:{" "}
          {existingDeposit !== undefined
            ? formatUnits(existingDeposit, 6)
            : "..."}{" "}
          USDC
        </p>
        <p>
          Vault Total:{" "}
          {vaultTotal !== undefined
            ? formatUnits(vaultTotal, 6)
            : "..."}{" "}
          USDC
        </p>
      </div>

      {step === "done" ? (
        <div>
          <p style={{ color: "green" }}>Deposit successful!</p>
          <p>Tx: {depositTxHash}</p>
          <button onClick={() => setStep("input")}>Deposit More</button>
        </div>
      ) : (
        <div>
          <input
            type="number"
            min="5"
            step="1"
            placeholder="Amount USDC (min 5)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={step !== "input"}
          />
          <button
            onClick={handleDeposit}
            disabled={
              step !== "input" ||
              !amount ||
              parseFloat(amount) < 5 ||
              isApproving
            }
          >
            {step === "input" && "Approve & Deposit"}
            {step === "approving" && "Approving..."}
            {step === "depositing" && "Depositing..."}
          </button>

          {(approveError || depositError) && (
            <p style={{ color: "red" }}>
              Error: {(approveError || depositError)?.message?.slice(0, 100)}
            </p>
          )}
        </div>
      )}

      {existingDeposit > 0n && (
        <div style={{ marginTop: "24px" }}>
          <button
            onClick={handleEmergencyWithdraw}
            disabled={isWithdrawing}
          >
            {isWithdrawing ? "Withdrawing..." : "Emergency Withdraw"}
          </button>
        </div>
      )}
    </div>
  );
}
