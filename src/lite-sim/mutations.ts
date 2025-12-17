import type { Address, EncodedAccount, ReadonlyUint8Array } from '@solana/kit';

/**
 * Account mutation tracking between before/after states
 */
export type AccountMutation = {
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
};

/**
 * Helper to compare two Uint8Arrays for equality
 */
function arraysEqual(
  a: Uint8Array | ReadonlyUint8Array,
  b: Uint8Array | ReadonlyUint8Array
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Compute mutations between before and after account states
 *
 * @param pubkey - The account address
 * @param before - Account state before transaction (or null if didn't exist)
 * @param after - Account state after transaction (or null if deleted)
 * @returns AccountMutation describing the changes
 */
function computeMutation(
  pubkey: Address,
  before: EncodedAccount | null,
  after: EncodedAccount | null
): AccountMutation {
  const existedBefore = before !== null;
  const existedAfter = after !== null;

  const ownerBefore = before?.programAddress ?? null;
  const ownerAfter = after?.programAddress ?? null;

  const lamportsBefore = before?.lamports ?? null;
  const lamportsAfter = after?.lamports ?? null;

  // Check if data changed
  let dataChanged = false;
  if (before && after) {
    dataChanged = !arraysEqual(before.data, after.data);
  } else if (before || after) {
    // Account created or deleted = data changed
    dataChanged = true;
  }

  return {
    pubkey,
    existedBefore,
    existedAfter,
    ownerBefore,
    ownerAfter,
    lamportsBefore,
    lamportsAfter,
    dataChanged,
    dataBefore: dataChanged ? (before ? new Uint8Array(before.data) : null) : null,
    dataAfter: dataChanged ? (after ? new Uint8Array(after.data) : null) : null,
  };
}

/**
 * Compute mutations for multiple accounts
 *
 * @param trackedAddresses - Set of addresses to track
 * @param before - Map of account states before transaction
 * @param after - Map of account states after transaction
 * @returns Array of mutations for all tracked accounts
 */
export function computeMutations(
  trackedAddresses: Set<Address>,
  before: Map<Address, EncodedAccount>,
  after: Map<Address, EncodedAccount>
): AccountMutation[] {
  const mutations: AccountMutation[] = [];

  for (const address of trackedAddresses) {
    const beforeAccount = before.get(address) ?? null;
    const afterAccount = after.get(address) ?? null;

    const mutation = computeMutation(address, beforeAccount, afterAccount);

    // Only include mutations where something actually changed
    if (
      mutation.existedBefore !== mutation.existedAfter ||
      mutation.ownerBefore !== mutation.ownerAfter ||
      mutation.lamportsBefore !== mutation.lamportsAfter ||
      mutation.dataChanged
    ) {
      mutations.push(mutation);
    }
  }

  return mutations;
}
