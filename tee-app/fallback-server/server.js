const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { execute } = require("../standalone/privacyBridge");

const app = express();
app.use(cors());
app.use(express.json());

const TEE_PRIVATE_KEY = process.env.TEE_PRIVATE_KEY;
const VAULT_ADDRESS = process.env.VAULT_ADDRESS;

if (!TEE_PRIVATE_KEY || !VAULT_ADDRESS) {
  console.error("Required env: TEE_PRIVATE_KEY, VAULT_ADDRESS");
  process.exit(1);
}

// Track ongoing executions
const executions = new Map();

app.post("/api/process-intent", async (req, res) => {
  const { hlDestination, destination, amount } = req.body;
  const dest = destination || hlDestination;

  if (!dest || !amount) {
    return res
      .status(400)
      .json({ error: "Missing destination or amount" });
  }

  if (amount < 5) {
    return res
      .status(400)
      .json({ error: "Minimum amount is 5 USDC (HL bridge minimum)" });
  }

  const executionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // Start execution in background
  executions.set(executionId, { status: "processing", startedAt: new Date() });

  execute(TEE_PRIVATE_KEY, VAULT_ADDRESS, dest, amount)
    .then((result) => {
      executions.set(executionId, { status: "completed", result });
    })
    .catch((err) => {
      executions.set(executionId, {
        status: "failed",
        error: err.message,
      });
    });

  res.json({ executionId, status: "processing" });
});

app.get("/api/status/:id", (req, res) => {
  const execution = executions.get(req.params.id);
  if (!execution) {
    return res.status(404).json({ error: "Execution not found" });
  }
  res.json(execution);
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", vault: VAULT_ADDRESS });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Fallback server running on port ${PORT}`);
  console.log(`Vault: ${VAULT_ADDRESS}`);
});
