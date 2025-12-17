/**
 * mcm-runner - MCM (Multi-Chain Multisig) proposal simulator
 *
 * Simulates the execution of MCM proposals on Solana using lite-sim.
 */

import { address } from '@solana/kit';
import { createSimulator, runSimulation } from '../lite-sim/index';
import { loadProposal } from './proposal/parser';
import { computeMerkleRoot } from './proposal/merkle';
import { createMcmSimulation } from './simulation';
import { createSimulationReport, type SimulationReport } from './report';

// Public API - Report types
export type { AccountMutationJson, InstructionResultJson, SimulationReport } from './report';

// Public API - Proposal types
export type {
  Proposal,
  ProposalWithRoot,
  ProposalInstruction,
  AccountMeta,
  MerkleProof,
} from './proposal/types';

// Public API - Simulation types
export type { McmSimulationConfig } from './simulation';

// Public API - Report functions
export { createSimulationReport, formatReportSummary } from './report';

// Public API - Proposal functions
export { loadProposal } from './proposal/parser';
export { computeMerkleRoot, hashMetadataLeaf, hashOperationLeaf } from './proposal/merkle';

// Public API - Simulation functions
export { createMcmSimulation } from './simulation';

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

  // Create simulation
  const simulation = await createMcmSimulation({
    proposalWithRoot,
    mcmProgram,
    ...(config.authorityAddress && { authority: address(config.authorityAddress) }),
  });

  // Create simulator and run
  const simulator = createSimulator(config.rpcUrl);
  const results = await runSimulation(simulator, simulation);

  // Generate report
  return createSimulationReport(results, proposalWithRoot);
};
