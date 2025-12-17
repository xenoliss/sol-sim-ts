import { sha256 } from '@noble/hashes/sha2.js';
import type { ReadonlyUint8Array } from '@solana/kit';
import type { AccountMutation, SimulationResults } from '../lite-sim/index';
import type { ProposalWithRoot } from './proposal/types';

/**
 * Account in JSON format
 */
export type AccountJson = {
  address: string;
  lamports: string; // Stringified bigint
  dataHash: string; // 0x-prefixed SHA256 hash
  owner: string;
  executable: boolean;
};

/**
 * Account mutation in JSON format
 */
export type AccountMutationJson = {
  pubkey: string;
  existedBefore: boolean;
  existedAfter: boolean;
  ownerBefore: string | null;
  ownerAfter: string | null;
  lamportsBefore: string | null; // Stringified bigint
  lamportsAfter: string | null;
  dataChanged: boolean;
  dataBeforeHex: string | null; // 0x-prefixed hex data
  dataAfterHex: string | null; // 0x-prefixed hex data
};

/**
 * Instruction result in JSON format
 */
export type InstructionResultJson = {
  index: number;
  nonce: string; // Stringified bigint
  programId: string;
  success: boolean;
  error: string | null;
  mutations: AccountMutationJson[];
};

/**
 * Simulation report in JSON format
 */
export type SimulationReport = {
  proposalRoot: string; // Hex
  validUntil: number;
  multisigId: string; // 0x-prefixed hex
  loadedAccounts: AccountJson[];
  accountOverrides: AccountJson[];
  instructions: InstructionResultJson[];
};

/**
 * Convert Uint8Array to 0x-prefixed hex string
 */
const toHex = (bytes: Uint8Array): `0x${string}` => {
  return `0x${Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')}`;
};

/**
 * Compute SHA256 hash of data and return as 0x-prefixed hex string
 */
const hashData = (data: Uint8Array | ReadonlyUint8Array): `0x${string}` => {
  const hash = sha256(data as Uint8Array);
  return toHex(hash);
};

/**
 * Convert EncodedAccount to JSON format
 */
const accountToJson = (account: import('@solana/kit').EncodedAccount): AccountJson => ({
  address: account.address,
  lamports: account.lamports.toString(),
  dataHash: hashData(account.data),
  owner: account.programAddress,
  executable: account.executable,
});

/**
 * Convert AccountMutation to JSON format
 */
const mutationToJson = (mutation: AccountMutation): AccountMutationJson => ({
  pubkey: mutation.pubkey,
  existedBefore: mutation.existedBefore,
  existedAfter: mutation.existedAfter,
  ownerBefore: mutation.ownerBefore,
  ownerAfter: mutation.ownerAfter,
  lamportsBefore: mutation.lamportsBefore?.toString() ?? null,
  lamportsAfter: mutation.lamportsAfter?.toString() ?? null,
  dataChanged: mutation.dataChanged,
  dataBeforeHex: mutation.dataBefore ? toHex(mutation.dataBefore) : null,
  dataAfterHex: mutation.dataAfter ? toHex(mutation.dataAfter) : null,
});

/**
 * Create simulation report from simulation results
 *
 * @param results - Simulation results from simulator
 * @param proposalWithRoot - Proposal with merkle root
 * @returns JSON-serializable simulation report
 */
export const createSimulationReport = (
  results: SimulationResults,
  proposalWithRoot: ProposalWithRoot
): SimulationReport => {
  const { proposal, root } = proposalWithRoot;

  // Convert loaded accounts
  const loadedAccounts: AccountJson[] = Array.from(results.loadedAccounts.values()).map(
    accountToJson
  );

  // Convert account overrides
  const accountOverrides: AccountJson[] = results.accountOverrides.map(([, account]) =>
    accountToJson(account)
  );

  // Convert instruction results
  const instructions: InstructionResultJson[] = results.batchResults.map((result, i) => {
    const nonce = proposal.rootMetadata.preOpCount + BigInt(i);
    const instruction = proposal.instructions[i];

    return {
      index: i,
      nonce: nonce.toString(),
      programId: instruction.programId,
      success: result.success,
      error: result.error,
      mutations: result.mutations.map(mutationToJson),
    };
  });

  return {
    proposalRoot: toHex(root),
    validUntil: proposal.validUntil,
    multisigId: toHex(proposal.multisigId),
    loadedAccounts,
    accountOverrides,
    instructions,
  };
};

/**
 * Get summary statistics from a simulation report
 */
export const getReportSummary = (
  report: SimulationReport
): {
  totalInstructions: number;
  successCount: number;
  failureCount: number;
  allSuccess: boolean;
} => {
  const totalInstructions = report.instructions.length;
  const successCount = report.instructions.filter(ix => ix.success).length;
  const failureCount = totalInstructions - successCount;
  const allSuccess = successCount === totalInstructions;

  return {
    totalInstructions,
    successCount,
    failureCount,
    allSuccess,
  };
};

/**
 * Format report summary as a human-readable string
 */
export const formatReportSummary = (report: SimulationReport): string => {
  const summary = getReportSummary(report);

  let output = `
Simulation Report:
  Proposal Root: ${report.proposalRoot}
  Multisig ID: ${report.multisigId}
  Valid Until: ${new Date(report.validUntil * 1000).toISOString()}

  Instructions: ${summary.totalInstructions}
  ✓ Success: ${summary.successCount}
  ✗ Failed: ${summary.failureCount}

  Result: ${summary.allSuccess ? '✓ ALL PASSED' : '✗ SOME FAILED'}
`;

  // Add instruction details
  output += '\n\nInstructions:\n';
  for (const ix of report.instructions) {
    output += `\n  [${ix.index}] ${ix.success ? '✓' : '✗'} ${ix.programId}`;
    if (!ix.success && ix.error) {
      output += `\n      Error: ${ix.error}`;
    }
    if (ix.mutations.length > 0) {
      output += `\n      Mutations: ${ix.mutations.length} account(s) changed`;
      for (const mut of ix.mutations) {
        if (mut.dataChanged || mut.lamportsBefore !== mut.lamportsAfter) {
          output += `\n        - ${mut.pubkey}`;
          if (mut.lamportsBefore !== mut.lamportsAfter) {
            output += ` (${mut.lamportsBefore} → ${mut.lamportsAfter} lamports)`;
          }
          if (mut.dataChanged) {
            output += ` [data changed]`;
          }
        }
      }
    }
  }

  return output.trim();
};
