import {
  address,
  assertAccountExists,
  createSolanaRpc,
  fetchEncodedAccount,
  getProgramDerivedAddress,
  type Address,
} from '@solana/kit';
import type { Account } from './types.js';

// BPF Loader Upgradeable program ID
const BPF_LOADER_UPGRADEABLE_ID = address(
  'BPFLoaderUpgradeab1e11111111111111111111111'
);

/**
 * RPC client context
 */
export type RpcClient = {
  readonly rpc: ReturnType<typeof createSolanaRpc>;
};

/**
 * Create an RPC client
 */
export const createRpcClient = (rpcUrl: string): RpcClient => ({
  rpc: createSolanaRpc(rpcUrl),
});

/**
 * Fetch a single account from RPC
 * @param client - RPC client
 * @param pubkey - The account address to fetch
 * @returns The account data
 * @throws Error if account doesn't exist
 */
export const fetchAccount = async (
  client: RpcClient,
  pubkey: Address
): Promise<Account> => {
  const maybeAccount = await fetchEncodedAccount(client.rpc, pubkey);

  // Assert account exists (throws if not)
  assertAccountExists(maybeAccount);

  return {
    lamports: maybeAccount.lamports,
    data: maybeAccount.data,
    owner: maybeAccount.programAddress,
    executable: maybeAccount.executable,
    rentEpoch: 'rentEpoch' in maybeAccount ? (maybeAccount.rentEpoch as bigint) : 0n,
  };
};

/**
 * Fetch multiple accounts in parallel
 * @param client - RPC client
 * @param pubkeys - Array of account addresses to fetch
 * @returns Map of address to account data
 */
export const fetchAccounts = async (
  client: RpcClient,
  pubkeys: Address[]
): Promise<Map<Address, Account>> => {
  const accounts = new Map<Address, Account>();

  // Fetch all accounts in parallel
  const results = await Promise.allSettled(
    pubkeys.map((pubkey) => fetchAccount(client, pubkey))
  );

  for (let i = 0; i < pubkeys.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      accounts.set(pubkeys[i], result.value);
    } else {
      console.warn(
        `Failed to fetch account ${pubkeys[i]}: ${result.reason}`
      );
    }
  }

  return accounts;
};

/**
 * Fetch a program account, including ProgramData for upgradeable programs
 * @param client - RPC client
 * @param programId - The program address
 * @returns Map containing the program account and optionally the ProgramData account
 */
export const fetchProgram = async (
  client: RpcClient,
  programId: Address
): Promise<Map<Address, Account>> => {
  const accounts = new Map<Address, Account>();

  // Fetch the program account
  const programAccount = await fetchAccount(client, programId);
  accounts.set(programId, programAccount);

  // Check if it's an upgradeable program
  if (programAccount.owner === BPF_LOADER_UPGRADEABLE_ID) {
    // Derive the ProgramData PDA
    const [programDataPda] = await getProgramDerivedAddress({
      programAddress: BPF_LOADER_UPGRADEABLE_ID,
      seeds: [programId as unknown as Uint8Array], // The program address is the seed
    });

    try {
      // Fetch the ProgramData account
      const programDataAccount = await fetchAccount(client, programDataPda);
      accounts.set(programDataPda, programDataAccount);
    } catch (e) {
      console.warn(
        `Failed to fetch ProgramData for ${programId}: ${e}`
      );
    }
  }

  return accounts;
};

/**
 * Fetch all accounts needed for a simulation
 * Handles both regular accounts and program accounts
 * @param client - RPC client
 * @param accountAddresses - Array of account addresses
 * @param programAddresses - Array of program addresses
 * @returns Map of all fetched accounts
 */
export const fetchAllAccounts = async (
  client: RpcClient,
  accountAddresses: Address[],
  programAddresses: Address[]
): Promise<Map<Address, Account>> => {
  const allAccounts = new Map<Address, Account>();

  // Fetch regular accounts
  const accounts = await fetchAccounts(client, accountAddresses);
  for (const [addr, account] of accounts) {
    allAccounts.set(addr, account);
  }

  // Fetch programs (including ProgramData for upgradeables)
  for (const programId of programAddresses) {
    const programAccounts = await fetchProgram(client, programId);
    for (const [addr, account] of programAccounts) {
      allAccounts.set(addr, account);
    }
  }

  return allAccounts;
};
