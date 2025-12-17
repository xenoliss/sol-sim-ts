/**
 * litesim - Lightweight Solana transaction simulator
 *
 * A generic, reusable framework for simulating Solana transactions
 * with signature verification disabled and account mutation tracking.
 */

// Core types
export type {
  Account,
  AccountMutation,
  BatchResult,
} from './types.js';

export { AccountMutationHelpers } from './types.js';

// Simulation interface
export type { Simulation } from './simulation.js';

// Main simulator functions
export type { SimulatorContext } from './simulator.js';
export { createSimulator, runSimulation } from './simulator.js';

// Account loading functions (for advanced usage)
export type { RpcClient } from './account-loader.js';
export {
  createRpcClient,
  fetchAccount,
  fetchAccounts,
  fetchProgram,
  fetchAllAccounts,
} from './account-loader.js';

// Mutation computation (for custom implementations)
export { computeMutation, computeMutations } from './mutations.js';
