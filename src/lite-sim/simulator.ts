import { lamports, type Address, type Instruction, type EncodedAccount } from '@solana/kit';
import { fromLegacyPublicKey } from '@solana/compat';
import { LiteSVM } from 'litesvm';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { createRpcClient, fetchAllAccounts, type RpcClient } from './account-loader';
import { computeMutations, type AccountMutation } from './mutations';
import type { Simulation } from './simulation';

/**
 * Result of executing a single batch (transaction)
 */
export type BatchResult = {
  index: number;
  success: boolean;
  error: string | null;
  mutations: AccountMutation[];
};

/**
 * Complete simulation results including loaded accounts and overrides
 */
export type SimulationResults = {
  batchResults: BatchResult[];
  loadedAccounts: Map<Address, EncodedAccount>;
  accountOverrides: [Address, EncodedAccount][];
};

/**
 * Convert Address (@solana/kit) to legacy PublicKey
 *
 * This is needed for litesvm compatibility, which uses the legacy @solana/web3.js types.
 * Address in @solana/kit is a string type, while litesvm expects PublicKey objects.
 *
 * @param addr - Address from @solana/kit (string)
 * @returns PublicKey for use with litesvm
 */
const toPublicKey = (addr: Address): PublicKey => {
  return new PublicKey(addr as string);
};

/**
 * Convert legacy PublicKey to Address (@solana/kit)
 *
 * Uses @solana/compat to convert from legacy web3.js PublicKey to modern @solana/kit Address.
 *
 * @param pubkey - Legacy PublicKey from @solana/web3.js
 * @returns Address (string) for use with @solana/kit
 */
const toAddress = (pubkey: PublicKey): Address => {
  return fromLegacyPublicKey(pubkey);
};

/**
 * Simulator context - holds the SVM and RPC client
 */
export type SimulatorContext = {
  readonly svm: LiteSVM;
  readonly rpcClient: RpcClient;
};

/**
 * Create a new simulator context
 *
 * @param rpcUrl - RPC endpoint URL
 * @returns Simulator context
 */
export const createSimulator = (rpcUrl: string): SimulatorContext => ({
  svm: new LiteSVM()
    .withSigverify(false)
    .withSysvars()
    .withBuiltins()
    .withDefaultPrograms()
    .withPrecompiles(),
  rpcClient: createRpcClient(rpcUrl),
});

/**
 * Run a simulation
 *
 * @param ctx - Simulator context
 * @param simulation - The simulation to execute
 * @returns Simulation results including batch results, loaded accounts, and overrides
 */
export const runSimulation = async <S extends Simulation>(
  ctx: SimulatorContext,
  simulation: S
): Promise<SimulationResults> => {
  // Step 1: Load accounts from RPC
  const loadedAccounts = await loadAccounts(ctx, simulation);

  // Step 2: Apply account overrides
  const accountOverrides = simulation.accountOverrides();
  applyAccountOverrides(ctx, simulation);

  // Step 3: Set clock timestamp if specified
  setClockTimestamp(ctx, simulation);

  // Step 4: Execute batches
  const batchResults: BatchResult[] = [];
  const batches = simulation.batches();

  for (let i = 0; i < batches.length; i++) {
    const result = await executeBatch(ctx, simulation, i, batches[i]);
    batchResults.push(result);
    // Continue executing remaining batches even if one fails (for complete report)
  }

  return {
    batchResults,
    loadedAccounts,
    accountOverrides,
  };
};

/**
 * Load all required accounts from RPC
 * Programs are automatically detected and their ProgramData accounts are fetched
 */
const loadAccounts = async <S extends Simulation>(
  ctx: SimulatorContext,
  simulation: S
): Promise<Map<Address, EncodedAccount>> => {
  const addresses = simulation.accountsToLoad();

  // Fetch all accounts from RPC (programs are automatically detected)
  const accountMap = await fetchAllAccounts(ctx.rpcClient, addresses);

  // Load accounts into LiteSVM
  for (const [addr, account] of accountMap) {
    ctx.svm.setAccount(toPublicKey(addr), {
      lamports: Number(account.lamports),
      data: Buffer.from(account.data),
      owner: toPublicKey(account.programAddress),
      executable: account.executable,
    });
  }

  return accountMap;
};

/**
 * Apply account overrides (override RPC data)
 */
const applyAccountOverrides = <S extends Simulation>(
  ctx: SimulatorContext,
  simulation: S
): void => {
  const accountOverrides = simulation.accountOverrides();

  for (const [addr, account] of accountOverrides) {
    ctx.svm.setAccount(toPublicKey(addr), {
      lamports: Number(account.lamports),
      data: Buffer.from(account.data),
      owner: toPublicKey(account.programAddress),
      executable: account.executable,
    });
  }
};

/**
 * Set the clock sysvar timestamp
 */
const setClockTimestamp = <S extends Simulation>(ctx: SimulatorContext, simulation: S): void => {
  const timestamp = simulation.clockTimestamp();
  if (timestamp !== null) {
    ctx.svm.warpToSlot(timestamp); // litesvm warpToSlot takes bigint
  }
};

/**
 * Execute a single batch (transaction)
 */
const executeBatch = async <S extends Simulation>(
  ctx: SimulatorContext,
  simulation: S,
  batchIndex: number,
  instructions: Instruction[]
): Promise<BatchResult> => {
  const payerConfig = simulation.payer(batchIndex);
  const payer = payerConfig.address;
  const trackedAddresses = simulation.accountsToTrack(batchIndex);

  try {
    // Airdrop to payer if requested
    if (payerConfig.airdropAmount !== undefined) {
      airdrop(ctx, payer, payerConfig.airdropAmount);
    }

    // Snapshot before state
    const beforeState = snapshotAccounts(ctx, trackedAddresses);

    // Convert Instruction to TransactionInstruction
    const legacyInstructions = instructions.map(ix => {
      return new TransactionInstruction({
        programId: toPublicKey(ix.programAddress),
        keys: (ix.accounts ?? []).map(acc => ({
          pubkey: toPublicKey(acc.address),
          isSigner: acc.role === 1 || acc.role === 3, // WritableSigner or ReadonlySigner
          isWritable: acc.role === 0 || acc.role === 1, // Writable or WritableSigner
        })),
        data: Buffer.from(ix.data ?? new Uint8Array()),
      });
    });

    // Create transaction
    const transaction = new Transaction();
    transaction.recentBlockhash = ctx.svm.latestBlockhash();
    transaction.feePayer = toPublicKey(payer);
    transaction.add(...legacyInstructions);

    // Execute transaction (litesvm doesn't require signing in test mode)
    const result = ctx.svm.sendTransaction(transaction);

    // Check if transaction failed
    if ('err' in result) {
      // FailedTransactionMetadata case
      const error = result.err ? result.err() : result.toString();
      console.error(`\n[Transaction Failed] Batch ${batchIndex}`);
      console.error('Details:', result.toString());
      return {
        index: batchIndex,
        success: false,
        error: typeof error === 'string' ? error : JSON.stringify(error),
        mutations: [],
      };
    }

    // Snapshot after state
    const afterState = snapshotAccounts(ctx, trackedAddresses);

    // Compute mutations
    const mutations = computeMutations(trackedAddresses, beforeState, afterState);

    return {
      index: batchIndex,
      success: true,
      error: null,
      mutations,
    };
  } catch (error) {
    return {
      index: batchIndex,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      mutations: [],
    };
  }
};

/**
 * Airdrop lamports to an account
 */
const airdrop = (ctx: SimulatorContext, addr: Address, amount: bigint): void => {
  // Use litesvm's built-in airdrop
  const result = ctx.svm.airdrop(toPublicKey(addr), amount);
  if (result && 'err' in result) {
    console.error(`[Error] Failed to airdrop ${amount} lamports to ${addr}`);
  }
};

/**
 * Snapshot account states
 */
const snapshotAccounts = (
  ctx: SimulatorContext,
  addresses: Set<Address>
): Map<Address, EncodedAccount> => {
  const snapshot = new Map<Address, EncodedAccount>();

  for (const addr of addresses) {
    const account = ctx.svm.getAccount(toPublicKey(addr));
    if (account) {
      // Convert litesvm AccountInfo to EncodedAccount
      snapshot.set(addr, {
        address: addr,
        lamports: lamports(BigInt(account.lamports)),
        data: new Uint8Array(account.data), // Copy array
        programAddress: toAddress(account.owner),
        executable: account.executable,
        space: BigInt(account.data.length),
      });
    }
  }

  return snapshot;
};
