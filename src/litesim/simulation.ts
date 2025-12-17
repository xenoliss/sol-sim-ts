import type { Address, IInstruction } from '@solana/kit';
import type { Account } from './types.js';

/**
 * Simulation trait - Defines the contract for any simulation implementation
 *
 * This is the core abstraction that allows different types of simulations
 * (MCM proposals, token transfers, etc.) to use the same simulation framework.
 */
export interface Simulation {
  /**
   * Returns the fee payer's address for a given batch index
   * @param batchIndex - The index of the batch (transaction)
   * @returns The address that will pay transaction fees
   */
  payer(batchIndex: number): Address;

  /**
   * Returns all accounts that should be loaded from RPC
   * This includes program accounts, data accounts, etc.
   * @returns Array of account addresses to fetch from the network
   */
  accounts(): Address[];

  /**
   * Returns accounts to mock with custom data (overrides RPC data)
   * Useful for testing scenarios or setting up specific account states
   * @returns Array of tuples [address, account data]
   */
  mockedAccounts(): Array<[Address, Account]>;

  /**
   * Optional Unix timestamp to set for the Clock sysvar
   * Useful for testing time-dependent logic
   * @returns Unix timestamp in seconds, or null to use current time
   */
  clockTimestamp(): bigint | null;

  /**
   * Returns instruction batches to execute
   * Each inner array represents a single transaction (atomic batch)
   * @returns Array of transaction batches
   */
  batches(): IInstruction[][];

  /**
   * Returns accounts to track for mutations in a given batch
   * Only these accounts will have their state changes recorded
   * @param batchIndex - The index of the batch (transaction)
   * @returns Set of account addresses to track
   */
  trackedAccounts(batchIndex: number): Set<Address>;
}
