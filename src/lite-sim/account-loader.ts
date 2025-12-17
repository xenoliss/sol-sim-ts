import {
  address,
  assertAccountExists,
  assertAccountsExist,
  createSolanaRpc,
  fetchEncodedAccount,
  fetchEncodedAccounts,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
  type EncodedAccount,
} from '@solana/kit';

// BPF Loader Upgradeable program ID
const BPF_LOADER_UPGRADEABLE_ID = address('BPFLoaderUpgradeab1e11111111111111111111111');

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
 */
const fetchAccount = async (client: RpcClient, pubkey: Address): Promise<EncodedAccount> => {
  const maybeAccount = await fetchEncodedAccount(client.rpc, pubkey);

  // Assert account exists (throws if not, TypeScript infers the type)
  assertAccountExists(maybeAccount);

  return maybeAccount;
};

/**
 * Fetch multiple accounts in a single batch RPC call
 * @param client - RPC client
 * @param pubkeys - Array of account addresses to fetch
 * @returns Map of address to account data
 * @throws Error if any account doesn't exist
 */
const fetchAccounts = async (
  client: RpcClient,
  pubkeys: Address[]
): Promise<Map<Address, EncodedAccount>> => {
  const accounts = new Map<Address, EncodedAccount>();

  if (pubkeys.length === 0) {
    return accounts;
  }

  // Fetch all accounts in a single batch RPC call
  const maybeAccounts = await fetchEncodedAccounts(client.rpc, pubkeys);

  // Assert all accounts exist (throws if any is missing)
  assertAccountsExist(maybeAccounts);

  // All accounts exist, TypeScript now knows they're all valid
  for (let i = 0; i < maybeAccounts.length; i++) {
    accounts.set(pubkeys[i], maybeAccounts[i]);
  }

  return accounts;
};

/**
 * Fetch all accounts needed for a simulation
 * Automatically detects and handles program accounts (including ProgramData for upgradeables)
 * @param client - RPC client
 * @param addresses - Array of account addresses
 * @returns Map of all fetched accounts
 */
export const fetchAllAccounts = async (
  client: RpcClient,
  addresses: Address[]
): Promise<Map<Address, EncodedAccount>> => {
  const allAccounts = new Map<Address, EncodedAccount>();

  // Fetch all accounts
  const accounts = await fetchAccounts(client, addresses);

  // Process each account, detecting programs automatically
  for (const [addr, account] of accounts) {
    // If account is executable, check if it's an upgradeable program
    if (account.executable && account.programAddress === BPF_LOADER_UPGRADEABLE_ID) {
      // Derive the ProgramData PDA
      const [programDataPda] = await getProgramDerivedAddress({
        programAddress: BPF_LOADER_UPGRADEABLE_ID,
        seeds: [getAddressEncoder().encode(addr)],
      });

      // Fetch the ProgramData account
      const programDataAccount = await fetchAccount(client, programDataPda);
      allAccounts.set(programDataPda, programDataAccount);
    }

    allAccounts.set(addr, account);
  }

  return allAccounts;
};
