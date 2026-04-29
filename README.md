# MagicBlock Payments CLI

A standalone NestJS CLI tool for executing private token transfers using the MagicBlock Payments API on Solana.

## Installation

```bash
npm install -g magicblock-payments-cli
```

## Usage

### Private Transfer

Execute a secure, private token transfer using the MagicBlock zk-circuit proofs.

```bash
magicblock transfer --to <recipient_address> --amount <amount> --key <your_private_key_base58>
```

#### Options:
- `-t, --to <address>`: The destination Solana wallet address.
- `-a, --amount <number>`: The amount of tokens (e.g., USDC) to transfer.
- `-k, --key <privateKeyBase58>`: Your private key in Base58 format (used for local signing).

## Features
- **Privacy**: Leverages MagicBlock's private rollup for encrypted transfers.
- **Security**: Transactions are signed locally; your private key never leaves your machine.
- **Simplicity**: No complex program management required—just use the API.

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run locally
node dist/main.js transfer [options]
```

## License
MIT
