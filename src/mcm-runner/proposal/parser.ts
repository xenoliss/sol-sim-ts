import { readFile } from 'fs/promises';
import { address } from '@solana/kit';
import type {
  Proposal,
  ProposalJson,
  ProposalInstruction,
  AccountMeta,
  RootMetadata,
} from './types';

/**
 * Parse hex string with 0x prefix to Uint8Array
 *
 * Converts a hexadecimal string with 0x prefix (e.g., "0x1234abcd") to a byte array.
 * Used for parsing multisigId and other hex-encoded fields in proposal JSON.
 *
 * @param hex - Hex string with 0x prefix
 * @returns Byte array representation
 * @throws Error if string doesn't start with 0x or has odd length
 */
const parseHex = (hex: string): Uint8Array => {
  if (!hex.startsWith('0x')) {
    throw new Error(`Invalid hex string: must start with 0x`);
  }

  const hexString = hex.slice(2);
  if (hexString.length % 2 !== 0) {
    throw new Error(`Invalid hex string: odd length`);
  }

  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = hexString.slice(i * 2, i * 2 + 2);
    bytes[i] = parseInt(byte, 16);
  }

  return bytes;
};

/**
 * Parse base64 string to Uint8Array
 *
 * Converts a base64-encoded string to a byte array.
 * Used for parsing instruction data in proposal JSON.
 *
 * @param base64 - Base64-encoded string
 * @returns Byte array representation
 */
const parseBase64 = (base64: string): Uint8Array => {
  return Uint8Array.from(Buffer.from(base64, 'base64'));
};

/**
 * Validate and parse proposal JSON to typed Proposal structure
 */
const validateProposal = (json: ProposalJson): Proposal => {
  // Parse multisigId
  const multisigId = parseHex(json.multisigId);
  if (multisigId.length !== 32) {
    throw new Error(`multisigId must be 32 bytes, got ${multisigId.length}`);
  }

  // Parse root metadata
  const rootMetadata: RootMetadata = {
    chainId: BigInt(json.rootMetadata.chainId),
    multisig: address(json.rootMetadata.multisig),
    preOpCount: BigInt(json.rootMetadata.preOpCount),
    postOpCount: BigInt(json.rootMetadata.postOpCount),
    overridePreviousRoot: json.rootMetadata.overridePreviousRoot,
  };

  // Validate operation counts
  if (rootMetadata.postOpCount <= rootMetadata.preOpCount) {
    throw new Error(
      `postOpCount (${rootMetadata.postOpCount}) must be > preOpCount (${rootMetadata.preOpCount})`
    );
  }

  const expectedInstructionCount = rootMetadata.postOpCount - rootMetadata.preOpCount;

  if (BigInt(json.instructions.length) !== expectedInstructionCount) {
    throw new Error(
      `Expected ${expectedInstructionCount} instructions, got ${json.instructions.length}`
    );
  }

  // Parse instructions
  const instructions: ProposalInstruction[] = json.instructions.map(ix => {
    const accounts: AccountMeta[] = ix.accounts.map(acc => ({
      pubkey: address(acc.pubkey),
      isSigner: acc.isSigner,
      isWritable: acc.isWritable,
    }));

    return {
      programId: address(ix.programId),
      data: parseBase64(ix.data),
      accounts,
    };
  });

  return {
    multisigId,
    validUntil: json.validUntil,
    instructions,
    rootMetadata,
  };
};

/**
 * Load proposal from JSON file
 *
 * @param path - Path to proposal JSON file
 * @returns Parsed and validated proposal
 */
export const loadProposal = async (path: string): Promise<Proposal> => {
  const fileContent = await readFile(path, 'utf-8');
  const json = JSON.parse(fileContent) as ProposalJson;
  return validateProposal(json);
};
