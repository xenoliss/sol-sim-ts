import { getProgramDerivedAddress, type Address } from '@solana/kit';

/**
 * MCM PDAs - All program-derived addresses for a given multisig
 */
export type McmPdas = {
  multisigConfig: Address;
  rootMetadata: Address;
  expiringRootAndOpCount: Address;
  multisigSigner: Address; // Used for CPI signing
};

/**
 * Derive all MCM PDAs for a given multisig ID
 *
 * @param mcmProgram - MCM program address
 * @param multisigId - 32-byte multisig identifier
 * @returns All derived PDAs
 */
export const deriveMcmPdas = async (
  mcmProgram: Address,
  multisigId: Uint8Array
): Promise<McmPdas> => {
  const textEncoder = new TextEncoder();

  const [multisigConfig] = await getProgramDerivedAddress({
    programAddress: mcmProgram,
    seeds: [textEncoder.encode('multisig_config'), multisigId],
  });

  const [rootMetadata] = await getProgramDerivedAddress({
    programAddress: mcmProgram,
    seeds: [textEncoder.encode('root_metadata'), multisigId],
  });

  const [expiringRootAndOpCount] = await getProgramDerivedAddress({
    programAddress: mcmProgram,
    seeds: [textEncoder.encode('expiring_root_and_op_count'), multisigId],
  });

  const [multisigSigner] = await getProgramDerivedAddress({
    programAddress: mcmProgram,
    seeds: [textEncoder.encode('multisig_signer'), multisigId],
  });

  return {
    multisigConfig,
    rootMetadata,
    expiringRootAndOpCount,
    multisigSigner,
  };
};
