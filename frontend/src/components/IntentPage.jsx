import { useState } from "react";
import { useAccount } from "wagmi";
import { IAPP_ADDRESS, IEXEC_HUB_ADDRESS, FALLBACK_API } from "../config/contracts";

export default function IntentPage({ onTaskCreated }) {
  const { isConnected } = useAccount();
  const [hlDestination, setHlDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("fallback"); // "iexec" | "fallback"
  const [status, setStatus] = useState("idle"); // idle | submitting | submitted | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmitIExec = async () => {
    setStatus("submitting");
    setError(null);

    try {
      // Dynamic import to avoid loading iexec if not needed
      const { IExec } = await import("iexec");
      const iexec = new IExec(
        { ethProvider: window.ethereum },
        { hubAddress: IEXEC_HUB_ADDRESS }
      );

      // Push requester secret
      const secretValue = JSON.stringify({
        hlDestination,
        amount: parseFloat(amount),
        vaultAddress: import.meta.env.VITE_VAULT_ADDRESS,
      });

      await iexec.secrets.pushRequesterSecret("1", secretValue);

      // Fetch app order
      const { orders: appOrders } =
        await iexec.orderbook.fetchAppOrderbook(IAPP_ADDRESS);
      const appOrder = appOrders[0]?.order;
      if (!appOrder) throw new Error("No app order available");

      // Fetch workerpool order (must match tee,scone tag)
      const { orders: wpOrders } =
        await iexec.orderbook.fetchWorkerpoolOrderbook({
          category: 0,
          tag: ["tee", "scone"],
        });
      const workerpoolOrder = wpOrders[0]?.order;
      if (!workerpoolOrder)
        throw new Error("No TEE workerpool order available (tee,scone)");

      // Create request order
      const requestOrderToSign = await iexec.order.createRequestorder({
        app: IAPP_ADDRESS,
        appmaxprice: appOrder.appprice,
        workerpoolmaxprice: workerpoolOrder.workerpoolprice,
        requester: await iexec.wallet.getAddress(),
        category: 0,
        volume: 1,
        tag: ["tee", "scone"],
        params: {
          iexec_secrets: { 1: "1" },
        },
      });

      const requestOrder =
        await iexec.order.signRequestorder(requestOrderToSign);

      // Match orders
      const { dealid } = await iexec.order.matchOrders({
        apporder: appOrder,
        workerpoolorder: workerpoolOrder,
        requestorder: requestOrder,
      });

      const taskid = await iexec.deal.computeTaskId(dealid, 0);

      setResult({ dealid, taskid, mode: "iexec" });
      setStatus("submitted");

      if (onTaskCreated) onTaskCreated(taskid);
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  const handleSubmitFallback = async () => {
    setStatus("submitting");
    setError(null);

    try {
      const res = await fetch(`${FALLBACK_API}/api/process-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hlDestination,
          amount: parseFloat(amount),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");

      setResult({ executionId: data.executionId, mode: "fallback" });
      setStatus("submitted");

      if (onTaskCreated) onTaskCreated(data.executionId);
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  const handleSubmit = () => {
    if (mode === "iexec") handleSubmitIExec();
    else handleSubmitFallback();
  };

  if (!isConnected) {
    return <div>Connect your wallet to submit an intent.</div>;
  }

  return (
    <div>
      <h2>Submit Privacy Intent</h2>
      <p>
        Your intent is encrypted and sent to the TEE. Only the enclave can read
        your Hyperliquid destination address.
      </p>

      <div style={{ marginBottom: "12px" }}>
        <label>
          <input
            type="radio"
            value="iexec"
            checked={mode === "iexec"}
            onChange={() => setMode("iexec")}
          />{" "}
          iExec TEE (production)
        </label>
        <label style={{ marginLeft: "16px" }}>
          <input
            type="radio"
            value="fallback"
            checked={mode === "fallback"}
            onChange={() => setMode("fallback")}
          />{" "}
          Fallback Server (demo)
        </label>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "400px" }}>
        <input
          type="text"
          placeholder="Hyperliquid destination address (0x...)"
          value={hlDestination}
          onChange={(e) => setHlDestination(e.target.value)}
          disabled={status === "submitting"}
        />
        <input
          type="number"
          min="5"
          step="1"
          placeholder="Amount USDC (min 5)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={status === "submitting"}
        />
        <button
          onClick={handleSubmit}
          disabled={
            status === "submitting" ||
            !hlDestination ||
            !amount ||
            parseFloat(amount) < 5
          }
        >
          {status === "submitting"
            ? "Submitting..."
            : `Submit via ${mode === "iexec" ? "iExec TEE" : "Fallback"}`}
        </button>
      </div>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {status === "submitted" && result && (
        <div style={{ marginTop: "16px" }}>
          <p style={{ color: "green" }}>Intent submitted!</p>
          {result.mode === "iexec" && (
            <>
              <p>Deal ID: {result.dealid}</p>
              <p>Task ID: {result.taskid}</p>
            </>
          )}
          {result.mode === "fallback" && (
            <p>Execution ID: {result.executionId}</p>
          )}
        </div>
      )}
    </div>
  );
}
