import { address, type Address, type IInstruction } from '@solana/kit';
import { LiteSVM } from 'litesvm';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { createRpcClient, fetchAllAccounts, type RpcClient } from './account-loader.js';
import { computeMutations } from './mutations.js';
import type { Simulation } from './simulation.js';
import type { Account, BatchResult } from './types.js';

// Constants
const LAMPORTS_PER_SOL = 1_000_000_000n;
const AIRDROP_AMOUNT = 100n * LAMPORTS_PER_SOL; // 100 SOL per payer

/**
 * Convert Address (@solana/kit) to PublicKey (@solana/web3.js)
 * Address is just a string in @solana/kit, so we create a new PublicKey from it
 */
const toPublicKey = (addr: Address): PublicKey => {
  return new PublicKey(addr as string);
};

/**
 * Convert PublicKey (@solana/web3.js) to Address (@solana/kit)
 */
const toAddress = (pubkey: PublicKey): Address => {
  return address(pubkey.toBase58());
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
  svm: new LiteSVM(),
  rpcClient: createRpcClient(rpcUrl),
});

/**
 * Run a simulation
 *
 * @param ctx - Simulator context
 * @param simulation - The simulation to execute
 * @returns Array of batch results with mutations
 */
export const runSimulation = async <S extends Simulation>(
  ctx: SimulatorContext,
  simulation: S
): Promise<BatchResult[]> => {
  // Step 1: Load accounts from RPC
  await loadAccounts(ctx, simulation);

  // Step 2: Apply mocked accounts
  applyMockedAccounts(ctx, simulation);

  // Step 3: Set clock timestamp if specified
  setClockTimestamp(ctx, simulation);

  // Step 4: Execute batches
  const results: BatchResult[] = [];
  const batches = simulation.batches();

  for (let i = 0; i < batches.length; i++) {
    const result = await executeBatch(ctx, simulation, i, batches[i]);
    results.push(result);

    // Continue executing remaining batches even if one fails (for complete report)
    if (!result.success) {
      console.warn(`Batch ${i} failed: ${result.error}`);
    }
  }

  return results;
};

/**
 * Load all required accounts from RPC
 */
const loadAccounts = async <S extends Simulation>(
  ctx: SimulatorContext,
  simulation: S
): Promise<void> => {
  const addresses = simulation.accounts();

  // Fetch all accounts from RPC
  const accountMap = await fetchAllAccounts(ctx.rpcClient, addresses, []);

  // Load accounts into LiteSVM
  for (const [addr, account] of accountMap) {
    ctx.svm.setAccount(toPublicKey(addr), {
      lamports: Number(account.lamports),
      data: Buffer.from(account.data),
      owner: toPublicKey(account.owner),
      executable: account.executable,
      rentEpoch: Number(account.rentEpoch),
    });
  }
};

/**
 * Apply mocked accounts (override RPC data)
 */
const applyMockedAccounts = <S extends Simulation>(
  ctx: SimulatorContext,
  simulation: S
): void => {
  const mockedAccounts = simulation.mockedAccounts();

  for (const [addr, account] of mockedAccounts) {
    ctx.svm.setAccount(toPublicKey(addr), {
      lamports: Number(account.lamports),
      data: Buffer.from(account.data),
      owner: toPublicKey(account.owner),
      executable: account.executable,
      rentEpoch: Number(account.rentEpoch),
    });
  }
};

/**
 * Set the clock sysvar timestamp
 */
const setClockTimestamp = <S extends Simulation>(
  ctx: SimulatorContext,
  simulation: S
): void => {
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
  instructions: IInstruction[]
): Promise<BatchResult> => {
  const payer = simulation.payer(batchIndex);
  const trackedAddresses = simulation.trackedAccounts(batchIndex);

  try {
    // Fund the payer
    airdrop(ctx, payer, AIRDROP_AMOUNT);

    // Snapshot before state
    const beforeState = snapshotAccounts(ctx, trackedAddresses);

    // Convert IInstruction to TransactionInstruction
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
    transaction.add(...legacyInstructions);

    // Execute transaction (litesvm doesn't require signing in test mode)
    const result = ctx.svm.sendTransaction(transaction);

    // Check if transaction succeeded
    if ('err' in result && result.err) {
      return {
        index: batchIndex,
        success: false,
        error: JSON.stringify(result.err),
        mutations: [],
      };
    }

    // Snapshot after state
    const afterState = snapshotAccounts(ctx, trackedAddresses);

    // Compute mutations
    const mutations = computeMutations(
      trackedAddresses,
      beforeState,
      afterState
    );

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
const airdrop = (
  ctx: SimulatorContext,
  addr: Address,
  amount: bigint
): void => {
  // Use litesvm's built-in airdrop
  ctx.svm.airdrop(toPublicKey(addr), amount);
};

/**
 * Snapshot account states
 */
const snapshotAccounts = (
  ctx: SimulatorContext,
  addresses: Set<Address>
): Map<Address, Account> => {
  const snapshot = new Map<Address, Account>();

  for (const addr of addresses) {
    const account = ctx.svm.getAccount(toPublicKey(addr));
    if (account) {
      // Deep clone the account data
      snapshot.set(addr, {
        lamports: BigInt(account.lamports),
        data: new Uint8Array(account.data), // Copy array
        owner: toAddress(account.owner),
        executable: account.executable,
        rentEpoch: account.rentEpoch !== undefined ? BigInt(account.rentEpoch) : 0n,
      });
    }
  }

  return snapshot;
};
