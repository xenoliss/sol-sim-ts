import type { Address } from '@solana/kit';

/**
 * Solana account structure
 * Matches the Account type from Solana SDK
 */
export interface Account {
  lamports: bigint;
  data: Uint8Array;
  owner: Address;
  executable: boolean;
  rentEpoch: bigint;
}

/**
 * Account mutation tracking between before/after states
 */
export interface AccountMutation {
  pubkey: Address;
  existedBefore: boolean;
  existedAfter: boolean;
  ownerBefore: Address | null;
  ownerAfter: Address | null;
  lamportsBefore: bigint | null;
  lamportsAfter: bigint | null;
  dataChanged: boolean;
  dataBefore: Uint8Array | null;
  dataAfter: Uint8Array | null;
}

/**
 * Result of executing a single batch (transaction)
 */
export interface BatchResult {
  index: number;
  success: boolean;
  error: string | null;
  mutations: AccountMutation[];
}

/**
 * Helper functions for AccountMutation
 */
export class AccountMutationHelpers {
  /**
   * Check if the account was created in this transaction
   */
  static isCreation(mutation: AccountMutation): boolean {
    return !mutation.existedBefore && mutation.existedAfter;
  }

  /**
   * Check if the account was deleted (closed) in this transaction
   */
  static isDeletion(mutation: AccountMutation): boolean {
    return mutation.existedBefore && !mutation.existedAfter;
  }

  /**
   * Check if the account owner changed
   */
  static ownerChanged(mutation: AccountMutation): boolean {
    if (!mutation.ownerBefore || !mutation.ownerAfter) {
      return false;
    }
    return mutation.ownerBefore !== mutation.ownerAfter;
  }

  /**
   * Calculate the net lamport change (positive = increase, negative = decrease)
   */
  static lamportsDelta(mutation: AccountMutation): bigint {
    const before = mutation.lamportsBefore ?? 0n;
    const after = mutation.lamportsAfter ?? 0n;
    return after - before;
  }
}
