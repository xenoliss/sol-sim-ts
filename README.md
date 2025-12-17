# simulator-ts

Solana transaction simulator using litesvm and @solana/kit - TypeScript implementation

A complete TypeScript port of the Rust simulator project, built with functional programming patterns and modern Solana development tools.

## Features

- **Functional Programming**: Pure functions throughout, no classes (à la viem.sh)
- **litesim Framework**: Generic, reusable simulation framework for any Solana transaction
- **MCM Runner**: Specialized MCM (Multi-Chain Multisig) proposal simulator
- **Signature Verification Disabled**: Test transactions without private keys
- **Account Mutation Tracking**: Track all state changes during simulation
- **Modern Solana SDK**: Built on @solana/kit (web3.js 2.x)

## Installation

```bash
npm install
npm run build
```

## Dependencies

- `@solana/kit` - Modern Solana JavaScript SDK
- `litesvm` - Lightweight Solana VM for testing
- `@coral-xyz/borsh` - Borsh serialization (Anchor-compatible)
- `@noble/hashes` - Cryptographic hashes (SHA-256, Keccak-256)

## Project Structure

```
src/
├── litesim/              # Generic simulation framework
│   ├── types.ts          # Core types (Account, BatchResult, AccountMutation)
│   ├── simulation.ts     # Simulation interface
│   ├── account-loader.ts # RPC account fetching
│   ├── mutations.ts      # Mutation tracking
│   ├── simulator.ts      # Main simulator (functional)
│   └── index.ts          # Public API
│
├── mcm-runner/           # MCM-specific implementation
│   ├── program/          # MCM program types
│   │   ├── accounts.ts   # Anchor account encoding/decoding
│   │   ├── discriminator.ts # Anchor discriminators
│   │   ├── pda.ts        # PDA derivation
│   │   └── instruction.ts # Instruction builders
│   ├── proposal/         # Proposal handling
│   │   ├── types.ts      # Proposal data structures
│   │   ├── parser.ts     # JSON parsing
│   │   └── merkle.ts     # Merkle tree computation
│   ├── simulation.ts     # MCM simulation factory
│   ├── report.ts         # Report generation
│   └── index.ts          # Public API
│
└── cli.ts                # CLI entry point
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

# Full options
npm start -- \
  --proposal proposal.json \
  --rpc https://api.mainnet-beta.solana.com \
  --mcm-program 7w7ELBSd4F6xG7GNq6BU9cnMPpQYq8fZknsk6Jb9mszY \
  --output report.json
```

### Programmatic Usage

#### Basic Simulation

```typescript
import { createSimulator, runSimulation, type Simulation } from './litesim/index.js';
import { address, type Address, type IInstruction } from '@solana/kit';

// Define your simulation using functional interface
const mySimulation: Simulation = {
  payer: () => address('YOUR_PAYER_ADDRESS'),

  accounts: () => [
    // Accounts to load from RPC
    address('ACCOUNT_1'),
    address('ACCOUNT_2'),
  ],

  mockedAccounts: () => [
    // Optional: Override RPC data with mock accounts
  ],

  clockTimestamp: () => null, // Optional: Set clock time

  batches: () => [
    // Each array is a transaction
    [/* instruction 1 */],
    [/* instruction 2 */],
  ],

  trackedAccounts: () => new Set([
    // Accounts to track for mutations
    address('TRACKED_ACCOUNT'),
  ]),
};

// Run simulation
const simulator = createSimulator('https://api.mainnet-beta.solana.com');
const results = await runSimulation(simulator, mySimulation);

// Process results
for (const result of results) {
  console.log(`Batch ${result.index}: ${result.success ? 'SUCCESS' : 'FAILED'}`);

  for (const mutation of result.mutations) {
    console.log(`  ${mutation.pubkey} changed`);
  }
}
```

#### MCM Simulation

```typescript
import {
  runMcmSimulation,
  formatReportSummary,
} from './mcm-runner/index.js';

// Simple API
const report = await runMcmSimulation({
  proposalPath: './proposal.json',
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  mcmProgramId: '7w7ELBSd4F6xG7GNq6BU9cnMPpQYq8fZknsk6Jb9mszY',
});

console.log(formatReportSummary(report));
```

#### Advanced MCM Simulation

```typescript
import { address } from '@solana/kit';
import { createSimulator, runSimulation } from './litesim/index.js';
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

// Create simulation (functional factory)
const simulation = await createMcmSimulation({
  proposalWithRoot,
  mcmProgram: address('7w7ELBSd4F6xG7GNq6BU9cnMPpQYq8fZknsk6Jb9mszY'),
  authority: address('YOUR_AUTHORITY'),
});

// Run simulation
const simulator = createSimulator('https://api.mainnet-beta.solana.com');
const results = await runSimulation(simulator, simulation);

// Generate report
const report = createSimulationReport(results, proposalWithRoot);

console.log(JSON.stringify(report, null, 2));
```

## Proposal JSON Format

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

### litesim

**Core Functions:**
- `createSimulator(rpcUrl)` - Create simulator context
- `runSimulation(ctx, simulation)` - Run a simulation

**Account Loading:**
- `createRpcClient(rpcUrl)` - Create RPC client
- `fetchAccount(client, address)` - Fetch single account
- `fetchAccounts(client, addresses)` - Fetch multiple accounts
- `fetchProgram(client, programId)` - Fetch program + ProgramData

**Mutation Tracking:**
- `computeMutation(pubkey, before, after)` - Compute single mutation
- `computeMutations(tracked, before, after)` - Compute all mutations

### mcm-runner

**Main Entry Point:**
- `runMcmSimulation(config)` - Complete MCM simulation

**Proposal Handling:**
- `loadProposal(path)` - Load and validate JSON
- `computeMerkleRoot(proposal)` - Calculate merkle tree
- `hashMetadataLeaf(proposal)` - Hash metadata
- `hashOperationLeaf(proposal, ix, nonce)` - Hash operation

**Simulation:**
- `createMcmSimulation(config)` - Create MCM simulation (factory)

**Program Utilities:**
- `deriveMcmPdas(program, multisigId)` - Derive all PDAs
- `buildExecuteInstruction(params)` - Build execute instruction
- `accountDiscriminator(name)` - Anchor account discriminator
- `instructionDiscriminator(name)` - Anchor instruction discriminator

**Reporting:**
- `createSimulationReport(results, proposal)` - Generate JSON report
- `formatReportSummary(report)` - Human-readable summary

## Functional Programming Patterns

This project uses **pure functions** throughout, inspired by viem.sh:

```typescript
// ✅ Factory functions, not classes
const simulator = createSimulator(rpcUrl);

// ✅ Pure functions with explicit parameters
const results = await runSimulation(simulator, simulation);

// ✅ Functional composition with pipe
import { pipe } from '@solana/kit';

const transaction = pipe(
  createTransactionMessage({ version: 0 }),
  tx => setTransactionMessageFeePayer(payer, tx),
  tx => appendTransactionMessageInstructions(instructions, tx)
);
```

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

## Architecture Decisions

- **No Classes**: All code uses functional programming patterns
- **Immutable Data**: All transformations return new objects
- **Type Safety**: Comprehensive TypeScript types throughout
- **Modern Solana SDK**: Uses @solana/kit instead of legacy web3.js
- **Audited Dependencies**: @noble/hashes (audited), @coral-xyz/borsh (maintained)

## Comparison with Rust Version

This TypeScript implementation maintains **100% functional parity** with the Rust simulator:

| Feature | Rust | TypeScript |
|---------|------|------------|
| Signature verification disabled | ✓ | ✓ |
| Account loading from RPC | ✓ | ✓ |
| Upgradeable program support | ✓ | ✓ |
| Mock account support | ✓ | ✓ |
| Clock sysvar mocking | ✓ | ✓ |
| Batch execution | ✓ | ✓ |
| Mutation tracking | ✓ | ✓ |
| MCM proposal simulation | ✓ | ✓ |
| Merkle tree (Keccak256) | ✓ | ✓ |
| Anchor account encoding | ✓ | ✓ |
| PDA derivation | ✓ | ✓ |
| JSON reporting | ✓ | ✓ |

**Key Differences:**
- Rust uses `struct` + `impl`, TypeScript uses functional factories
- Rust uses traits, TypeScript uses interfaces
- Both are type-safe and memory-safe

## License

MIT
