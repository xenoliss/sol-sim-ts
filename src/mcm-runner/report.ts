import type { AccountMutation, BatchResult } from '../litesim/index.js';
import type { ProposalWithRoot } from './proposal/types.js';

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
  dataLengthBefore: number | null;
  dataLengthAfter: number | null;
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
  instructions: InstructionResultJson[];
};

/**
 * Convert Uint8Array to hex string
 */
const toHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Convert Uint8Array to 0x-prefixed hex string
 */
const to0xHex = (bytes: Uint8Array): string => {
  return '0x' + toHex(bytes);
};

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
  dataLengthBefore: mutation.dataBefore?.length ?? null,
  dataLengthAfter: mutation.dataAfter?.length ?? null,
});

/**
 * Create simulation report from batch results
 *
 * @param results - Batch results from simulator
 * @param proposalWithRoot - Proposal with merkle root
 * @returns JSON-serializable simulation report
 */
export const createSimulationReport = (
  results: BatchResult[],
  proposalWithRoot: ProposalWithRoot
): SimulationReport => {
  const { proposal, root } = proposalWithRoot;

  const instructions: InstructionResultJson[] = results.map((result, i) => {
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
    multisigId: to0xHex(proposal.multisigId),
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
  const successCount = report.instructions.filter((ix) => ix.success).length;
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

  return `
Simulation Report:
  Proposal Root: ${report.proposalRoot}
  Multisig ID: ${report.multisigId}
  Valid Until: ${new Date(report.validUntil * 1000).toISOString()}

  Instructions: ${summary.totalInstructions}
  ✓ Success: ${summary.successCount}
  ✗ Failed: ${summary.failureCount}

  Result: ${summary.allSuccess ? '✓ ALL PASSED' : '✗ SOME FAILED'}
`.trim();
};
