import * as borsh from '@coral-xyz/borsh';
import type { Address, IInstruction, IAccountMeta } from '@solana/kit';
import { instructionDiscriminator } from './discriminator.js';
import type { McmPdas } from './pda.js';
import type { MerkleProof } from '../proposal/types.js';

/**
 * Simple account meta type for input
 */
type SimpleAccountMeta = {
  pubkey: Address;
  isSigner: boolean;
  isWritable: boolean;
};

/**
 * Execute instruction arguments
 */
export type ExecuteArgs = {
  multisigId: Uint8Array; // 32 bytes
  chainId: bigint; // u64
  nonce: bigint; // u64
  data: Uint8Array; // Vec<u8>
  proof: MerkleProof; // Vec<[u8; 32]>
};

// Borsh schema for ExecuteArgs
const ExecuteArgsSchema = borsh.struct([
  borsh.array(borsh.u8(), 32, 'multisigId'),
  borsh.u64('chainId'),
  borsh.u64('nonce'),
  borsh.vec(borsh.u8(), 'data'),
  borsh.vec(borsh.array(borsh.u8(), 32), 'proof'),
]);

/**
 * Build the execute instruction
 *
 * @param mcmProgram - MCM program address
 * @param pdas - Derived MCM PDAs
 * @param args - Execute instruction arguments
 * @param to - Target program to execute
 * @param remainingAccounts - Accounts passed to target program
 * @param authority - Signer authority
 * @returns Execute instruction
 */
/**
 * Convert SimpleAccountMeta to IAccountMeta with role
 */
const toIAccountMeta = (meta: SimpleAccountMeta): IAccountMeta => {
  // Determine role: 0 = Writable, 1 = WritableSigner, 2 = Readonly, 3 = ReadonlySigner
  let role: 0 | 1 | 2 | 3;
  if (meta.isWritable && meta.isSigner) {
    role = 1; // WritableSigner
  } else if (meta.isWritable) {
    role = 0; // Writable
  } else if (meta.isSigner) {
    role = 3; // ReadonlySigner
  } else {
    role = 2; // Readonly
  }

  return {
    address: meta.pubkey,
    role,
  };
};

export const buildExecuteInstruction = (params: {
  mcmProgram: Address;
  pdas: McmPdas;
  args: ExecuteArgs;
  to: Address;
  remainingAccounts: SimpleAccountMeta[];
  authority: Address;
}): IInstruction => {
  const { mcmProgram, pdas, args, to, remainingAccounts, authority } = params;

  // Encode instruction data
  const discriminator = instructionDiscriminator('execute');
  const argsEncoded = ExecuteArgsSchema.encode(args);

  const data = new Uint8Array(discriminator.length + argsEncoded.length);
  data.set(discriminator, 0);
  data.set(argsEncoded, discriminator.length);

  // Build accounts array
  const accounts: IAccountMeta[] = [
    toIAccountMeta({ pubkey: pdas.multisigConfig, isSigner: false, isWritable: false }),
    toIAccountMeta({ pubkey: pdas.rootMetadata, isSigner: false, isWritable: false }),
    toIAccountMeta({ pubkey: pdas.expiringRootAndOpCount, isSigner: false, isWritable: true }),
    toIAccountMeta({ pubkey: to, isSigner: false, isWritable: false }),
    toIAccountMeta({ pubkey: pdas.multisigSigner, isSigner: false, isWritable: false }),
    toIAccountMeta({ pubkey: authority, isSigner: true, isWritable: true }),
    ...remainingAccounts.map(toIAccountMeta),
  ];

  return {
    programAddress: mcmProgram,
    accounts,
    data,
  };
};
