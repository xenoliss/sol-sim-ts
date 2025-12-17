#!/usr/bin/env node

import { writeFile } from 'fs/promises';
import { runMcmSimulation } from './index';

/**
 * Parse command line arguments
 */
const parseArgs = (): {
  proposalPath?: string;
  rpcUrl: string;
  mcmProgramId: string;
  outputPath?: string;
  authorityAddress?: string;
} => {
  const args = process.argv.slice(2);

  let proposalPath: string | undefined;
  let rpcUrl = 'https://api.mainnet-beta.solana.com';
  let mcmProgramId = '7w7ELBSd4F6xG7GNq6BU9cnMPpQYq8fZknsk6Jb9mszY';
  let outputPath: string | undefined;
  let authorityAddress: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-p':
      case '--proposal':
        proposalPath = args[++i];
        break;
      case '-r':
      case '--rpc':
        rpcUrl = args[++i];
        break;
      case '-m':
      case '--mcm-program':
        mcmProgramId = args[++i];
        break;
      case '-o':
      case '--output':
        outputPath = args[++i];
        break;
      case '-a':
      case '--authority':
        authorityAddress = args[++i];
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('-')) {
          proposalPath = arg;
        } else {
          console.error(`Unknown option: ${arg}`);
          printHelp();
          process.exit(1);
        }
    }
  }

  return { proposalPath, rpcUrl, mcmProgramId, outputPath, authorityAddress };
};

/**
 * Print help message
 */
const printHelp = () => {
  console.log(`
MCM Runner - Simulate MCM proposal execution on Solana

Usage: mcm-runner [options] <proposal-path>

Options:
  -p, --proposal <path>     Path to proposal JSON file
  -r, --rpc <url>           RPC endpoint URL
                            (default: https://api.mainnet-beta.solana.com)
  -m, --mcm-program <id>    MCM program ID
                            (default: 7w7ELBSd4F6xG7GNq6BU9cnMPpQYq8fZknsk6Jb9mszY)
  -o, --output <path>       Output path for JSON report (optional)
  -a, --authority <address> Authority address (optional)
  -h, --help                Show this help message

Examples:
  mcm-runner proposal.json
  mcm-runner -p proposal.json -r https://api.devnet.solana.com
  mcm-runner proposal.json --output report.json
`);
};

/**
 * Main CLI entry point
 */
const main = async () => {
  try {
    const { proposalPath, rpcUrl, mcmProgramId, outputPath, authorityAddress } = parseArgs();

    if (!proposalPath) {
      console.error('Error: Proposal path is required\n');
      printHelp();
      process.exit(1);
    }

    // Run simulation
    const report = await runMcmSimulation({
      proposalPath,
      rpcUrl,
      mcmProgramId,
      authorityAddress,
    });

    // Print JSON report
    console.log(JSON.stringify(report, null, 2));

    // Save report if output path specified
    if (outputPath) {
      await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
      console.log(`\nReport saved to: ${outputPath}`);
    }

    // Exit with appropriate code
    const allSuccess = report.instructions.every(ix => ix.success);
    process.exit(allSuccess ? 0 : 1);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

// Run CLI
main();
