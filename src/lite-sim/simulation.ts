import type { Address, Instruction, EncodedAccount } from '@solana/kit';

/**
 * Payer configuration for a simulation
 */
export type PayerConfig = {
  /** The address that will pay transaction fees */
  address: Address;
  /** Optional amount to airdrop to the payer. If undefined, no airdrop is performed. */
  airdropAmount?: bigint;
};

/**
 * Simulation trait - Defines the contract for any simulation implementation
 *
 * This is the core abstraction that allows different types of simulations
 * (MCM proposals, token transfers, etc.) to use the same simulation framework.
 */
export type Simulation = {
  /**
   * Returns the fee payer configuration for a given batch index
   * @param batchIndex - The index of the batch (transaction)
   * @returns Payer configuration (address and optional airdrop amount)
   */
  payer(batchIndex: number): PayerConfig;

  /**
   * Returns all accounts that should be loaded from RPC
   * This includes program accounts, data accounts, etc.
   * @returns Array of account addresses to fetch from the network
   */
  accountsToLoad(): Address[];

  /**
   * Returns accounts to override with custom data (overrides RPC data)
   * Useful for testing scenarios or setting up specific account states
   * @returns Array of tuples [address, account data]
   */
  accountOverrides(): Array<[Address, EncodedAccount]>;

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
  batches(): Instruction[][];

  /**
   * Returns accounts to track for mutations in a given batch
   * Only these accounts will have their state changes recorded
   * @param batchIndex - The index of the batch (transaction)
   * @returns Set of account addresses to track
   */
  accountsToTrack(batchIndex: number): Set<Address>;
};
