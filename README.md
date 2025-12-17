# sol-sim-ts

Solana transaction simulator using litesvm and @solana/kit - TypeScript implementation

## Installation

```bash
npm install
npm run build
```

## Dependencies

- `@solana/kit` - Modern Solana JavaScript SDK
- `@solana/web3.js` - Legacy Solana SDK (required by litesvm)
- `litesvm` - Lightweight Solana VM for testing
- `@noble/hashes` - Cryptographic hashes (SHA-256, Keccak-256)

## Project Structure

```
src/
├── lite-sim/             # Generic simulation framework
│   ├── simulation.ts     # Simulation interface
│   ├── account-loader.ts # RPC account fetching
│   ├── mutations.ts      # Mutation tracking
│   ├── simulator.ts      # Main simulator
│   └── index.ts          # Public API
│
└── mcm-runner/           # MCM-specific implementation
    ├── program/          # MCM program types
    │   ├── accounts.ts   # Anchor account encoding/decoding
    │   ├── discriminator.ts # Anchor discriminators
    │   ├── pda.ts        # PDA derivation
    │   └── instruction.ts # Instruction builders
    ├── proposal/         # Proposal handling
    │   ├── types.ts      # Proposal data structures
    │   ├── parser.ts     # JSON parsing
    │   └── merkle.ts     # Merkle tree computation
    ├── simulation.ts     # MCM simulation factory
    ├── report.ts         # Report generation
    ├── cli.ts            # CLI entry point
    └── index.ts          # Public API
```

## Usage

### CLI Usage

```bash
# Run MCM proposal simulation
npm start -- proposal.json

# With custom RPC
npm start -- proposal.json --rpc https://api.devnet.solana.com

# Save report to file
npm start -- proposal.json --output report.json

# With custom authority (uses real account balance, no airdrop)
npm start -- proposal.json --authority <AUTHORITY_ADDRESS>

# Full options
npm start -- \
  --proposal proposal.json \
  --rpc https://api.mainnet-beta.solana.com \
  --mcm-program 7w7ELBSd4F6xG7GNq6BU9cnMPpQYq8fZknsk6Jb9mszY \
  --authority <AUTHORITY_ADDRESS> \
  --output report.json
```

### Programmatic Usage

#### lite-sim API

`lite-sim` is the core library that defines the simulation process and exposes the public API. It provides a generic framework for simulating any Solana transaction by implementing the `Simulation` interface.

```typescript
import { createSimulator, runSimulation, type Simulation } from './lite-sim/index.js';
import { address, type Address, type Instruction } from '@solana/kit';

const mySimulation: Simulation = {
  payer: () => ({
    address: address('YOUR_PAYER_ADDRESS'),
    // Optional: airdropAmount: 100_000_000_000n, // 100 SOL
  }),

  accountsToLoad: () => [
    // Accounts to load from RPC
    address('ACCOUNT_1'),
    address('ACCOUNT_2'),
  ],

  accountOverrides: () => [
    // Optional: Override RPC data with custom accounts
  ],

  clockTimestamp: () => null, // Optional: Set clock time

  batches: () => [
    // Each array is a transaction
    [/* instruction 1 */],
    [/* instruction 2 */],
  ],

  accountsToTrack: (batchIndex) => new Set([
    // Accounts to track for mutations
    address('TRACKED_ACCOUNT'),
  ]),
};

// Run simulation
const simulator = createSimulator('https://api.mainnet-beta.solana.com');
const results = await runSimulation(simulator, mySimulation);

// Process results
console.log(`Loaded ${results.loadedAccounts.size} accounts from RPC`);
console.log(`Applied ${results.accountOverrides.length} account overrides`);

for (const result of results.batchResults) {
  console.log(`Batch ${result.index}: ${result.success ? 'SUCCESS' : 'FAILED'}`);

  for (const mutation of result.mutations) {
    console.log(`  ${mutation.pubkey} changed`);
  }
}
```

#### MCM Simulation

```typescript
import { address } from '@solana/kit';
import { createSimulator, runSimulation } from './lite-sim/index.js';
import {
  loadProposal,
  computeMerkleRoot,
  createMcmSimulation,
  createSimulationReport,
} from './mcm-runner/index.js';

// Load and validate proposal
const proposal = await loadProposal('./proposal.json');

// Compute merkle root
const proposalWithRoot = computeMerkleRoot(proposal);
console.log('Merkle root:', proposalWithRoot.root);

// Create simulation
const simulation = await createMcmSimulation({
  proposalWithRoot,
  mcmProgram: address('7w7ELBSd4F6xG7GNq6BU9cnMPpQYq8fZknsk6Jb9mszY'),
  authority: address('YOUR_AUTHORITY'), // Optional: if omitted, generates random authority with 100 SOL airdrop
});

// Run simulation
const simulator = createSimulator('https://api.mainnet-beta.solana.com');
const results = await runSimulation(simulator, simulation);

// Generate report
const report = createSimulationReport(results, proposalWithRoot);

console.log(JSON.stringify(report, null, 2));
```

**Proposal JSON Format:**

```json
{
  "multisigId": "0x1234...", // 32-byte hex with 0x prefix
  "validUntil": 1761410561, // Unix timestamp
  "instructions": [
    {
      "programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      "data": "base64-encoded-instruction-data",
      "accounts": [
        {
          "pubkey": "Account1...",
          "isSigner": false,
          "isWritable": true
        }
      ]
    }
  ],
  "rootMetadata": {
    "chainId": 0,
    "multisig": "ConfigAccount...",
    "preOpCount": 6,
    "postOpCount": 7,
    "overridePreviousRoot": false
  }
}
```

## API Reference

### lite-sim

**Public API:**
- `createSimulator(rpcUrl)` - Create simulator context
- `runSimulation(ctx, simulation)` - Run a simulation

**Types:**
- `Simulation` - Interface for defining simulations
- `PayerConfig` - Payer configuration (address + optional airdrop amount)
- `SimulatorContext` - Simulator context
- `BatchResult` - Result of executing a batch
- `AccountMutation` - Account state changes

### mcm-runner

**High-Level API:**
- `runMcmSimulation(config)` - Complete MCM simulation (main entry point)
- `formatReportSummary(report)` - Human-readable summary

**Types:**
- `RunMcmSimulationConfig` - Configuration for runMcmSimulation
- `SimulationReport` - JSON report structure
- `InstructionResultJson` - Instruction result
- `AccountMutationJson` - Account mutation in JSON format

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev -- proposal.json

# Run tests
npm test
```

## License

MIT
