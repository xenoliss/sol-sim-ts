import { getAddressCodec, type Address } from '@solana/kit';
import { accountDiscriminator } from './discriminator';

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

/**
 * Encode ExpiringRootAndOpCount to bytes (with discriminator)
 */
export const encodeExpiringRootAndOpCount = (data: ExpiringRootAndOpCount): Uint8Array => {
  const discriminator = accountDiscriminator('ExpiringRootAndOpCount');

  // Manually encode: 32 bytes root + 4 bytes u32 + 8 bytes u64
  const buffer = Buffer.alloc(32 + 4 + 8);
  buffer.set(data.root, 0);
  buffer.writeUInt32LE(data.validUntil, 32);
  buffer.writeBigUInt64LE(data.opCount, 36);

  const result = new Uint8Array(discriminator.length + buffer.length);
  result.set(discriminator, 0);
  result.set(buffer, discriminator.length);

  return result;
};

/**
 * Decode ExpiringRootAndOpCount from bytes (expects discriminator)
 */
export const decodeExpiringRootAndOpCount = (bytes: Uint8Array): ExpiringRootAndOpCount => {
  // Skip discriminator (first 8 bytes)
  const buffer = Buffer.from(bytes.slice(8));

  return {
    root: new Uint8Array(buffer.subarray(0, 32)),
    validUntil: buffer.readUInt32LE(32),
    opCount: buffer.readBigUInt64LE(36),
  };
};

/**
 * Encode RootMetadata to bytes (with discriminator)
 */
export const encodeRootMetadata = (data: RootMetadata): Uint8Array => {
  const discriminator = accountDiscriminator('RootMetadata');
  const addressCodec = getAddressCodec();

  // Manually encode: 8 bytes u64 + 32 bytes pubkey + 8 bytes u64 + 8 bytes u64 + 1 byte bool
  const buffer = Buffer.alloc(8 + 32 + 8 + 8 + 1);
  let offset = 0;

  buffer.writeBigUInt64LE(data.chainId, offset);
  offset += 8;

  buffer.set(addressCodec.encode(data.multisig), offset);
  offset += 32;

  buffer.writeBigUInt64LE(data.preOpCount, offset);
  offset += 8;

  buffer.writeBigUInt64LE(data.postOpCount, offset);
  offset += 8;

  buffer.writeUInt8(data.overridePreviousRoot ? 1 : 0, offset);

  const result = new Uint8Array(discriminator.length + buffer.length);
  result.set(discriminator, 0);
  result.set(buffer, discriminator.length);

  return result;
};

/**
 * Decode RootMetadata from bytes (expects discriminator)
 */
export const decodeRootMetadata = (bytes: Uint8Array): RootMetadata => {
  // Skip discriminator (first 8 bytes)
  const buffer = Buffer.from(bytes.slice(8));
  const addressCodec = getAddressCodec();
  let offset = 0;

  const chainId = buffer.readBigUInt64LE(offset);
  offset += 8;

  const multisigBytes = buffer.subarray(offset, offset + 32);
  const multisig = addressCodec.decode(multisigBytes);
  offset += 32;

  const preOpCount = buffer.readBigUInt64LE(offset);
  offset += 8;

  const postOpCount = buffer.readBigUInt64LE(offset);
  offset += 8;

  const overridePreviousRoot = buffer.readUInt8(offset) !== 0;

  return {
    chainId,
    multisig,
    preOpCount,
    postOpCount,
    overridePreviousRoot,
  };
};
