import type { Address, Instruction, AccountMeta } from '@solana/kit';
import { instructionDiscriminator } from './discriminator';
import type { McmPdas } from './pda';
import type { MerkleProof } from '../proposal/types';

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

/**
 * Encode ExecuteArgs manually (Borsh-compatible)
 */
const encodeExecuteArgs = (args: ExecuteArgs): Uint8Array => {
  // Calculate total size
  // 32 (multisigId) + 8 (chainId) + 8 (nonce) + 4 (data len) + data.length + 4 (proof len) + proof.length * 32
  const dataLen = args.data.length;
  const proofLen = args.proof.length;
  const totalSize = 32 + 8 + 8 + 4 + dataLen + 4 + proofLen * 32;

  const buffer = Buffer.alloc(totalSize);
  let offset = 0;

  // multisigId (32 bytes)
  buffer.set(args.multisigId, offset);
  offset += 32;

  // chainId (u64)
  buffer.writeBigUInt64LE(args.chainId, offset);
  offset += 8;

  // nonce (u64)
  buffer.writeBigUInt64LE(args.nonce, offset);
  offset += 8;

  // data (Vec<u8>): length (u32) + bytes
  buffer.writeUInt32LE(dataLen, offset);
  offset += 4;
  buffer.set(args.data, offset);
  offset += dataLen;

  // proof (Vec<[u8; 32]>): length (u32) + array of 32-byte chunks
  buffer.writeUInt32LE(proofLen, offset);
  offset += 4;
  for (const proofElement of args.proof) {
    buffer.set(proofElement, offset);
    offset += 32;
  }

  return new Uint8Array(buffer);
};

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
 * Convert SimpleAccountMeta to AccountMeta with role
 */
const toAccountMeta = (meta: SimpleAccountMeta): AccountMeta => {
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
}): Instruction => {
  const { mcmProgram, pdas, args, to, remainingAccounts, authority } = params;

  // Encode instruction data
  const discriminator = instructionDiscriminator('execute');
  const argsEncoded = encodeExecuteArgs(args);

  const data = new Uint8Array(discriminator.length + argsEncoded.length);
  data.set(discriminator, 0);
  data.set(argsEncoded, discriminator.length);

  // Build accounts array
  const accounts: AccountMeta[] = [
    toAccountMeta({ pubkey: pdas.multisigConfig, isSigner: false, isWritable: true }),
    toAccountMeta({ pubkey: pdas.rootMetadata, isSigner: false, isWritable: false }),
    toAccountMeta({ pubkey: pdas.expiringRootAndOpCount, isSigner: false, isWritable: true }),
    toAccountMeta({ pubkey: to, isSigner: false, isWritable: false }),
    toAccountMeta({ pubkey: pdas.multisigSigner, isSigner: false, isWritable: false }),
    toAccountMeta({ pubkey: authority, isSigner: true, isWritable: true }),
    ...remainingAccounts.map(toAccountMeta),
  ];

  return {
    programAddress: mcmProgram,
    accounts,
    data,
  };
};
