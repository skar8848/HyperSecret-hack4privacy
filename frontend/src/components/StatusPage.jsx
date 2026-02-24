import { useState, useEffect, useCallback } from "react";
import { FALLBACK_API, IEXEC_HUB_ADDRESS } from "../config/contracts";

const IEXEC_STATUS_MAP = {
  0: "UNSET",
  1: "ACTIVE",
  2: "REVEALING",
  3: "COMPLETED",
  4: "FAILED",
};

export default function StatusPage({ taskId }) {
  const [inputId, setInputId] = useState(taskId || "");
  const [mode, setMode] = useState("fallback"); // "iexec" | "fallback"
  const [statusData, setStatusData] = useState(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(null);

  const pollIExec = useCallback(async (id) => {
    try {
      const { IExec } = await import("iexec");
      const iexec = new IExec(
        { ethProvider: window.ethereum },
        { hubAddress: IEXEC_HUB_ADDRESS }
      );
      const task = await iexec.task.show(id);

      setStatusData({
        status: IEXEC_STATUS_MAP[task.status] || `UNKNOWN(${task.status})`,
        raw: task,
        completed: task.status === 3,
      });

      if (task.status === 3 || task.status === 4) {
        setPolling(false);
      }
    } catch (err) {
      setError(err.message);
      setPolling(false);
    }
  }, []);

  const pollFallback = useCallback(async (id) => {
    try {
      const res = await fetch(`${FALLBACK_API}/api/status/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Not found");

      setStatusData({
        status: data.status,
        result: data.result,
        error: data.error,
        completed: data.status === "completed",
      });

      if (data.status === "completed" || data.status === "failed") {
        setPolling(false);
      }
    } catch (err) {
      setError(err.message);
      setPolling(false);
    }
  }, []);

  // Polling loop
  useEffect(() => {
    if (!polling || !inputId) return;

    const interval = setInterval(() => {
      if (mode === "iexec") pollIExec(inputId);
      else pollFallback(inputId);
    }, 5000);

    // Initial poll
    if (mode === "iexec") pollIExec(inputId);
    else pollFallback(inputId);

    return () => clearInterval(interval);
  }, [polling, inputId, mode]);

  const handleTrack = () => {
    setError(null);
    setStatusData(null);
    setPolling(true);
  };

  return (
    <div>
      <h2>Track Execution</h2>

      <div style={{ marginBottom: "12px" }}>
        <label>
          <input
            type="radio"
            value="iexec"
            checked={mode === "iexec"}
            onChange={() => setMode("iexec")}
          />{" "}
          iExec Task ID
        </label>
        <label style={{ marginLeft: "16px" }}>
          <input
            type="radio"
            value="fallback"
            checked={mode === "fallback"}
            onChange={() => setMode("fallback")}
          />{" "}
          Fallback Execution ID
        </label>
      </div>

      <div style={{ display: "flex", gap: "8px", maxWidth: "500px" }}>
        <input
          type="text"
          placeholder={mode === "iexec" ? "Task ID (0x...)" : "Execution ID"}
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
          style={{ flex: 1 }}
        />
        <button onClick={handleTrack} disabled={!inputId || polling}>
          {polling ? "Polling..." : "Track"}
        </button>
      </div>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {statusData && (
        <div style={{ marginTop: "16px" }}>
          <h3>Status: {statusData.status}</h3>

          {statusData.completed && statusData.result && (
            <div>
              <h4>Execution Proof</h4>
              <table style={{ borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "4px 8px", fontWeight: "bold" }}>Fresh Wallet</td>
                    <td style={{ padding: "4px 8px" }}>{statusData.result.freshWallet}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "4px 8px", fontWeight: "bold" }}>Redistribute Tx</td>
                    <td style={{ padding: "4px 8px" }}>
                      <a
                        href={`https://sepolia.arbiscan.io/tx/${statusData.result.redistributeTx}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {statusData.result.redistributeTx?.slice(0, 18)}...
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "4px 8px", fontWeight: "bold" }}>Bridge Tx</td>
                    <td style={{ padding: "4px 8px" }}>
                      <a
                        href={`https://sepolia.arbiscan.io/tx/${statusData.result.bridgeTx}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {statusData.result.bridgeTx?.slice(0, 18)}...
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "4px 8px", fontWeight: "bold" }}>HL Transfer</td>
                    <td style={{ padding: "4px 8px" }}>
                      {JSON.stringify(statusData.result.hlTransfer)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {statusData.status === "failed" && statusData.error && (
            <p style={{ color: "red" }}>Failure: {statusData.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
