import { sha256 } from '@noble/hashes/sha2.js';

/**
 * Compute Anchor account discriminator
 *
 * Discriminator = SHA256("account:{name}")[0..8]
 *
 * @param name - Account name (e.g., "ExpiringRootAndOpCount")
 * @returns 8-byte discriminator
 */
export const accountDiscriminator = (name: string): Uint8Array => {
  const preimage = `account:${name}`;
  const hash = sha256(new TextEncoder().encode(preimage));
  return hash.slice(0, 8);
};

/**
 * Compute Anchor instruction discriminator
 *
 * Discriminator = SHA256("global:{name}")[0..8]
 *
 * @param name - Instruction name (e.g., "execute")
 * @returns 8-byte discriminator
 */
export const instructionDiscriminator = (name: string): Uint8Array => {
  const preimage = `global:${name}`;
  const hash = sha256(new TextEncoder().encode(preimage));
  return hash.slice(0, 8);
};
