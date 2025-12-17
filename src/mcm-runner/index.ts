/**
 * mcm-runner - MCM (Multi-Chain Multisig) proposal simulator
 *
 * Simulates the execution of MCM proposals on Solana using litesim.
 */

// Program types
export type {
  ExpiringRootAndOpCount,
  RootMetadata,
} from './program/accounts.js';

export {
  encodeExpiringRootAndOpCount,
  decodeExpiringRootAndOpCount,
  encodeRootMetadata,
  decodeRootMetadata,
} from './program/accounts.js';

export {
  accountDiscriminator,
  instructionDiscriminator,
} from './program/discriminator.js';

export type { McmPdas } from './program/pda.js';
export { deriveMcmPdas } from './program/pda.js';

export type { ExecuteArgs } from './program/instruction.js';
export { buildExecuteInstruction } from './program/instruction.js';

// Proposal types
export type {
  AccountMeta,
  ProposalInstruction,
  RootMetadata as ProposalRootMetadata,
  Proposal,
  MerkleProof,
  ProposalWithRoot,
  ProposalJson,
  ProposalInstructionJson,
  AccountMetaJson,
  RootMetadataJson,
} from './proposal/types.js';

export {
  hashMetadataLeaf,
  hashOperationLeaf,
  computeMerkleRoot,
} from './proposal/merkle.js';

export { loadProposal } from './proposal/parser.js';

// Simulation
export type { McmSimulationConfig } from './simulation.js';
export { createMcmSimulation } from './simulation.js';

// Report
export type {
  AccountMutationJson,
  InstructionResultJson,
  SimulationReport,
} from './report.js';

export {
  createSimulationReport,
  getReportSummary,
  formatReportSummary,
} from './report.js';

// Main entry point - Run complete MCM simulation
import { address } from '@solana/kit';
import { createSimulator, runSimulation } from '../litesim/index.js';
import { loadProposal } from './proposal/parser.js';
import { computeMerkleRoot } from './proposal/merkle.js';
import { createMcmSimulation } from './simulation.js';
import { createSimulationReport, type SimulationReport } from './report.js';

/**
 * Complete MCM simulation configuration
 */
export type RunMcmSimulationConfig = {
  proposalPath: string;
  rpcUrl: string;
  mcmProgramId: string;
  authorityAddress?: string;
};

/**
 * Run a complete MCM simulation from proposal file
 *
 * This is the main entry point for running MCM simulations.
 * It loads the proposal, computes the merkle root, runs the simulation,
 * and returns the results as a JSON report.
 *
 * @param config - Simulation configuration
 * @returns Simulation report
 */
export const runMcmSimulation = async (
  config: RunMcmSimulationConfig
): Promise<SimulationReport> => {
  // Load and validate proposal
  const proposal = await loadProposal(config.proposalPath);

  // Compute merkle root and proofs
  const proposalWithRoot = computeMerkleRoot(proposal);

  // Parse addresses
  const mcmProgram = address(config.mcmProgramId);
  const authority = config.authorityAddress
    ? address(config.authorityAddress)
    : address('11111111111111111111111111111111'); // Default

  // Create simulation
  const simulation = await createMcmSimulation({
    proposalWithRoot,
    mcmProgram,
    authority,
  });

  // Create simulator and run
  const simulator = createSimulator(config.rpcUrl);
  const results = await runSimulation(simulator, simulation);

  // Generate report
  return createSimulationReport(results, proposalWithRoot);
};
