import * as borsh from '@coral-xyz/borsh';
import type { Address } from '@solana/kit';
import { accountDiscriminator } from './discriminator.js';

/**
 * ExpiringRootAndOpCount account data (52 bytes total)
 * - discriminator: 8 bytes
 * - root: 32 bytes
 * - validUntil: 4 bytes (u32)
 * - opCount: 8 bytes (u64)
 */
export type ExpiringRootAndOpCount = {
  root: Uint8Array; // 32 bytes
  validUntil: number; // u32
  opCount: bigint; // u64
};

/**
 * RootMetadata account data (65 bytes total)
 * - discriminator: 8 bytes
 * - chainId: 8 bytes (u64)
 * - multisig: 32 bytes (Pubkey)
 * - preOpCount: 8 bytes (u64)
 * - postOpCount: 8 bytes (u64)
 * - overridePreviousRoot: 1 byte (bool)
 */
export type RootMetadata = {
  chainId: bigint; // u64
  multisig: Address;
  preOpCount: bigint; // u64
  postOpCount: bigint; // u64
  overridePreviousRoot: boolean;
};

// Borsh schemas
const ExpiringRootAndOpCountSchema = borsh.struct([
  borsh.array(borsh.u8(), 32, 'root'),
  borsh.u32('validUntil'),
  borsh.u64('opCount'),
]);

const RootMetadataSchema = borsh.struct([
  borsh.u64('chainId'),
  borsh.publicKey('multisig'),
  borsh.u64('preOpCount'),
  borsh.u64('postOpCount'),
  borsh.bool('overridePreviousRoot'),
]);

/**
 * Encode ExpiringRootAndOpCount to bytes (with discriminator)
 */
export const encodeExpiringRootAndOpCount = (
  data: ExpiringRootAndOpCount
): Uint8Array => {
  const discriminator = accountDiscriminator('ExpiringRootAndOpCount');
  const encoded = ExpiringRootAndOpCountSchema.encode(data);

  const result = new Uint8Array(discriminator.length + encoded.length);
  result.set(discriminator, 0);
  result.set(encoded, discriminator.length);

  return result;
};

/**
 * Decode ExpiringRootAndOpCount from bytes (expects discriminator)
 */
export const decodeExpiringRootAndOpCount = (
  bytes: Uint8Array
): ExpiringRootAndOpCount => {
  // Skip discriminator (first 8 bytes)
  const data = bytes.slice(8);
  return ExpiringRootAndOpCountSchema.decode(data) as ExpiringRootAndOpCount;
};

/**
 * Encode RootMetadata to bytes (with discriminator)
 */
export const encodeRootMetadata = (data: RootMetadata): Uint8Array => {
  const discriminator = accountDiscriminator('RootMetadata');
  const encoded = RootMetadataSchema.encode(data);

  const result = new Uint8Array(discriminator.length + encoded.length);
  result.set(discriminator, 0);
  result.set(encoded, discriminator.length);

  return result;
};

/**
 * Decode RootMetadata from bytes (expects discriminator)
 */
export const decodeRootMetadata = (bytes: Uint8Array): RootMetadata => {
  // Skip discriminator (first 8 bytes)
  const data = bytes.slice(8);
  return RootMetadataSchema.decode(data) as RootMetadata;
};
