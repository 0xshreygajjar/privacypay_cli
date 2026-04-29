# privacypay CLI

A command-line tool for executing **private token transfers**, **automated payroll**, and **vault withdrawals** 

> Transactions are signed locally — your private key never leaves your machine.

## Installation

```bash
npm install -g privacypay
```

## Commands

### `transfer` — Private Token Transfer

Execute a single private, confidential token transfer between two wallets on the Private Ephemeral Rollup.

```bash
privacypay transfer --to <recipient_address> --amount <amount> [--key <base58_private_key>] [--memo <string>]
```

**Options:**

| Flag | Description | Required |
|------|-------------|----------|
| `-t, --to <address>` | Destination Solana wallet address | ✅ |
| `-a, --amount <number>` | Amount of tokens to transfer (e.g. `10` for 10 USDC) | ✅ |
| `-k, --key <base58>` | Sender private key in Base58 format (prompts if omitted) | ❌ |
| `-m, --memo <string>` | Optional transaction memo (truncated to 20 chars) | ❌ |

**Example:**
```bash
privacypay transfer --to HZBPNsrg1hSU2ovycyQ4Tt3Ru4kBkP8imQbWcvM3BHQj --amount 5
```

---

### `payroll` — Batch Payroll from CSV

Execute private transfers to multiple recipients at once by reading from a CSV file. Ideal for recurring salary or vendor payments.

```bash
privacypay payroll --file <path_to_csv> [--key <base58_private_key>] [--memo <string>]
```

**Options:**

| Flag | Description | Required |
|------|-------------|----------|
| `-f, --file <path>` | Path to CSV file with `recipient,amount` columns | ✅ |
| `-k, --key <base58>` | Sender private key in Base58 format (prompts if omitted) | ❌ |
| `-m, --memo <string>` | Optional memo applied to all transactions | ❌ |

**CSV Format:**
```csv
recipient,amount
CAT7rAE3VhS8Kbp4TgsYjVqBcqSoFoPEmCvKAr5A8yKg,100.00
HZBPNsrg1hSU2ovycyQ4Tt3Ru4kBkP8imQbWcvM3BHQj,250.00
```

**Example:**
```bash
privacypay payroll --file ./payroll.csv --memo "April Salaries"
```

---

### `withdraw` — Withdraw from Private Vault

Move funds from your private ephemeral vault back to your public Solana wallet address.

```bash
privacypay withdraw --amount <amount> [--key <base58_private_key>] [--mint <token_mint_address>]
```

**Options:**

| Flag | Description | Required |
|------|-------------|----------|
| `-a, --amount <number>` | Amount of tokens to withdraw | ✅ |
| `-k, --key <base58>` | Private key of the vault owner (prompts if omitted) | ❌ |
| `-m, --mint <address>` | SPL Token Mint address (defaults to Devnet USDC) | ❌ |

**Example:**
```bash
privacypay withdraw --amount 10
```

---

## How It Works

1. **Authentication**: The CLI communicates with the Payments API, which issues signed transactions after verifying your keypair.
2. **Local Signing**: The returned transaction is deserialized, a fresh blockhash is fetched, and the transaction is signed locally with your keypair.
3. **Broadcast**: The signed transaction is sent to the appropriate cluster (`base` Solana devnet/mainnet or `ephemeral` rollup) and confirmed on-chain.

## Privacy Guarantees

- **Confidential Balances**: Token balances are hidden inside the Private Ephemeral Rollup (TEE-backed).
- **Private Transfers**: No on-chain observer can link sender and recipient.
- **Local Key Handling**: Your private key is only used to sign transactions locally — it is never transmitted.

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run locally without installing globally
node dist/main.js --help
```