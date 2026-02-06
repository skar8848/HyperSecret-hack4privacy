import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "./config/wagmi";
import ConnectButton from "./components/ConnectButton";
import DepositPage from "./components/DepositPage";
import IntentPage from "./components/IntentPage";
import StatusPage from "./components/StatusPage";

const queryClient = new QueryClient();

function App() {
  const [lastTaskId, setLastTaskId] = useState(null);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
                borderBottom: "1px solid #333",
                paddingBottom: "12px",
              }}
            >
              <h1 style={{ margin: 0 }}>PrivacyBridge</h1>
              <ConnectButton />
            </header>

            <nav style={{ marginBottom: "24px", display: "flex", gap: "16px" }}>
              <NavLink
                to="/"
                style={({ isActive }) => ({
                  fontWeight: isActive ? "bold" : "normal",
                })}
              >
                1. Deposit
              </NavLink>
              <NavLink
                to="/intent"
                style={({ isActive }) => ({
                  fontWeight: isActive ? "bold" : "normal",
                })}
              >
                2. Submit Intent
              </NavLink>
              <NavLink
                to="/status"
                style={({ isActive }) => ({
                  fontWeight: isActive ? "bold" : "normal",
                })}
              >
                3. Track
              </NavLink>
            </nav>

            <Routes>
              <Route path="/" element={<DepositPage />} />
              <Route
                path="/intent"
                element={<IntentPage onTaskCreated={setLastTaskId} />}
              />
              <Route
                path="/status"
                element={<StatusPage taskId={lastTaskId} />}
              />
            </Routes>
          </div>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
