import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import "./EarnPage.css";

const SparkleIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M5.882 2.611c.294-.687 1.225-.73 1.598-.129l.067.13.238.559a4.69 4.69 0 0 0 2.267 2.378l.206.094.56.239c.686.293.73 1.224.128 1.597l-.129.068-.56.238a4.69 4.69 0 0 0-2.378 2.268l-.094.206-.238.558c-.294.687-1.225.73-1.599.13l-.066-.13-.238-.558a4.693 4.693 0 0 0-2.268-2.38l-.205-.094-.56-.238c-.687-.294-.73-1.226-.129-1.599l.13-.066.559-.24A4.692 4.692 0 0 0 5.55 3.378l.094-.206.238-.56ZM11.51 10.005a.379.379 0 0 1 .667-.053l.028.053.108.254c.192.45.529.819.954 1.051l.188.09.255.11a.379.379 0 0 1 .053.667l-.053.027-.255.109c-.45.192-.819.529-1.051.954l-.091.189-.108.253a.378.378 0 0 1-.667.054l-.029-.054-.107-.253c-.192-.45-.53-.82-.955-1.052l-.188-.091-.254-.109a.378.378 0 0 1-.053-.667l.053-.028.254-.108c.45-.192.819-.529 1.051-.954l.092-.188.107-.254Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0.123"
    />
  </svg>
);

export default function EarnPage() {
  const { isConnected } = useAccount();

  return (
    <div className="earn-page">
      {/* Hero */}
      <div className="earn-hero">
        <h1 className="earn-title">
          <span className="earn-title-accent">Aled</span> Stake
        </h1>
        <div className="earn-description">
          Earn a share of bridge fees by providing liquidity to the PrivacyBridge
          protocol. Deposit USDC and participate in anonymous bridging to
          Hyperliquid via iExec TEE.
        </div>
      </div>

      {/* Action bar */}
      <div className="earn-action-bar">
        <button className="earn-claim-btn" disabled>
          <SparkleIcon />
          Claim Fees
          <span className="earn-claim-count">&nbsp;&middot; 0</span>
        </button>
        <div className="earn-network-btn">
          <span className="earn-network-label">Network:</span>
          <span className="earn-network-value">Arbitrum Sepolia</span>
          <svg
            className="earn-network-chevron"
            viewBox="0 0 10 6"
            fill="none"
          >
            <path d="m1 1 4 4 4-4" stroke="currentColor" />
          </svg>
        </div>
      </div>

      {/* Empty state */}
      <div className="earn-empty">No fees to claim yet.</div>

      {/* Stats grid */}
      <div className="earn-stats-grid">
        {/* Left card: Protocol stats */}
        <div className="earn-stats-card">
          <div className="earn-stats-card-header">
            <span className="earn-stats-card-title">Protocol Stats</span>
            <div className="earn-stats-card-icon protocol">$</div>
          </div>

          <div className="earn-stat">
            <div className="earn-stat-row">
              <span className="earn-stat-label">Total USDC Bridged</span>
              <span className="earn-stat-value">0.00</span>
            </div>
          </div>

          <div className="earn-stat">
            <div className="earn-stat-row">
              <span className="earn-stat-label">Total Transactions</span>
              <span className="earn-stat-value">0</span>
            </div>
          </div>

          <div className="earn-percent-grid">
            <div className="earn-percent-stat">
              <div className="earn-percent-label">Active Deposits</div>
              <div className="earn-percent-value">0</div>
            </div>
            <div className="earn-percent-divider" />
            <div className="earn-percent-stat">
              <div className="earn-percent-label">
                <span className="global">Avg</span> Bridge Time
              </div>
              <div className="earn-percent-value">~2 min</div>
            </div>
          </div>
        </div>

        {/* Right card: My stats */}
        <div className="earn-stats-card">
          <div className="earn-my-header">
            <div className="earn-my-power">
              <span className="earn-my-power-label">My Earnings</span>
              <span
                className={`earn-my-power-value ${!isConnected ? "muted" : ""}`}
              >
                {isConnected ? "0.00 USDC" : "-"}
              </span>
            </div>
            <div className="earn-stats-card-icon user">$</div>
          </div>

          <div className="earn-stat">
            <div className="earn-stat-row">
              <span className="earn-stat-label">My USDC Deposited</span>
              <span className={`earn-stat-value ${!isConnected ? "muted" : ""}`}>
                {isConnected ? "0.00" : "-"}
              </span>
            </div>
          </div>

          <div className="earn-stat">
            <div className="earn-stat-row">
              <span className="earn-stat-label">My Transactions</span>
              <span className={`earn-stat-value ${!isConnected ? "muted" : ""}`}>
                {isConnected ? "0" : "-"}
              </span>
            </div>
          </div>

          <div className="earn-stat">
            <div className="earn-stat-row">
              <span className="earn-stat-label">Available to Claim</span>
              <span className={`earn-stat-value ${!isConnected ? "muted" : ""}`}>
                {isConnected ? "0.00" : "-"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="earn-cta">
        <Link to="/" className="earn-cta-btn">
          <svg viewBox="0 0 31 31" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="m18.576 1.234.826 1.935a15.982 15.982 0 0 0 8.43 8.433l1.934.827c.505.218.919.522 1.234.895C30.03 6.418 24.578.96 17.68 0c.368.316.678.73.896 1.234ZM1.24 12.429l1.934-.827a16.012 16.012 0 0 0 8.436-8.433l.826-1.935c.218-.505.528-.918.896-1.234C6.421.959.97 6.418.005 13.318a3.38 3.38 0 0 1 1.234-.895v.006ZM29.762 18.571l-1.934.827a15.993 15.993 0 0 0-8.43 8.439l-.826 1.929A3.382 3.382 0 0 1 17.675 31c6.898-.964 12.35-6.418 13.314-13.318a3.38 3.38 0 0 1-1.234.895l.006-.006ZM12.43 29.765l-.826-1.93a16.023 16.023 0 0 0-8.436-8.438l-1.934-.826A3.315 3.315 0 0 1 0 17.674c.964 6.9 6.416 12.36 13.314 13.318a3.38 3.38 0 0 1-.896-1.234l.012.006Z"
              fill="#636366"
            />
            <path
              d="m8.473 13.984.953-.407A7.869 7.869 0 0 0 13.58 9.42l.407-.952c.568-1.332 2.462-1.332 3.03 0l.407.952a7.869 7.869 0 0 0 4.155 4.157l.953.407c1.331.569 1.331 2.457 0 3.031l-.953.408a7.868 7.868 0 0 0-4.154 4.156l-.408.953c-.568 1.332-2.462 1.332-3.03 0l-.407-.953a7.869 7.869 0 0 0-4.155-4.156l-.953-.408c-1.331-.568-1.331-2.457 0-3.03Z"
              fill="currentColor"
            />
          </svg>
          Start Bridging
        </Link>
      </div>
    </div>
  );
}
