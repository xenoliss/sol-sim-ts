import type { Address } from '@solana/kit';

/**
 * Account meta in a Solana instruction
 */
export type AccountMeta = {
  pubkey: Address;
  isSigner: boolean;
  isWritable: boolean;
};

/**
 * Instruction in the proposal
 */
export type ProposalInstruction = {
  programId: Address;
  data: Uint8Array; // Base64-encoded in JSON, decoded to Uint8Array
  accounts: AccountMeta[];
};

/**
 * Root metadata for the proposal
 */
export type RootMetadata = {
  chainId: bigint;
  multisig: Address;
  preOpCount: bigint;
  postOpCount: bigint;
  overridePreviousRoot: boolean;
};

/**
 * MCM Proposal structure
 */
export type Proposal = {
  multisigId: Uint8Array; // 32 bytes, hex-encoded with 0x prefix in JSON
  validUntil: number; // Unix timestamp (u32)
  instructions: ProposalInstruction[];
  rootMetadata: RootMetadata;
};

/**
 * Merkle proof - array of 32-byte hashes
 */
export type MerkleProof = Uint8Array[]; // Each element is 32 bytes

/**
 * Proposal with computed merkle root and proofs
 */
export type ProposalWithRoot = {
  proposal: Proposal;
  root: Uint8Array; // 32 bytes
  operationProofs: MerkleProof[]; // One proof per operation (excludes metadata proof)
};

/**
 * JSON format of the proposal (as loaded from file)
 * Uses camelCase and string representations for compatibility
 */
export type ProposalJson = {
  multisigId: string; // 0x-prefixed hex
  validUntil: number;
  instructions: ProposalInstructionJson[];
  rootMetadata: RootMetadataJson;
};

export type ProposalInstructionJson = {
  programId: string; // Base58
  data: string; // Base64
  accounts: AccountMetaJson[];
};

export type AccountMetaJson = {
  pubkey: string; // Base58
  isSigner: boolean;
  isWritable: boolean;
};

export type RootMetadataJson = {
  chainId: number;
  multisig: string; // Base58
  preOpCount: number;
  postOpCount: number;
  overridePreviousRoot: boolean;
};
