import { lamports, type Address, type EncodedAccount } from '@solana/kit';
import { PublicKey } from '@solana/web3.js';
import { fromLegacyPublicKey } from '@solana/compat';
import type { Simulation, PayerConfig } from '../lite-sim';
import { buildExecuteInstruction, type ExecuteArgs } from './program/instruction';
import { deriveMcmPdas } from './program/pda';
import {
  encodeExpiringRootAndOpCount,
  encodeRootMetadata,
  type ExpiringRootAndOpCount,
  type RootMetadata,
} from './program/accounts';
import type { ProposalWithRoot } from './proposal/types';

/**
 * MCM simulation configuration
 */
export type McmSimulationConfig = {
  proposalWithRoot: ProposalWithRoot;
  mcmProgram: Address;
  authority?: Address; // Optional: if not provided, a random authority will be generated with airdrop
};

/**
 * Create an MCM simulation
 *
 * This is a factory function that returns a Simulation object
 * configured for executing MCM proposal instructions.
 *
 * @param config - MCM simulation configuration
 * @returns Simulation object ready to be run
 */
export const createMcmSimulation = async (config: McmSimulationConfig): Promise<Simulation> => {
  const { proposalWithRoot, mcmProgram } = config;
  const { proposal, root, operationProofs } = proposalWithRoot;

  // Generate authority if not provided
  const authority = config.authority ?? fromLegacyPublicKey(PublicKey.unique());

  // Derive PDAs
  const pdas = await deriveMcmPdas(mcmProgram, proposal.multisigId);

  // Create account overrides
  const expiringRootOverride: ExpiringRootAndOpCount = {
    root,
    validUntil: proposal.validUntil,
    opCount: proposal.rootMetadata.preOpCount,
  };

  const rootMetadataOverride: RootMetadata = {
    chainId: proposal.rootMetadata.chainId,
    multisig: proposal.rootMetadata.multisig,
    preOpCount: proposal.rootMetadata.preOpCount,
    postOpCount: proposal.rootMetadata.postOpCount,
    overridePreviousRoot: proposal.rootMetadata.overridePreviousRoot,
  };

  const expiringRootData = encodeExpiringRootAndOpCount(expiringRootOverride);
  const expiringRootAccount: EncodedAccount = {
    address: pdas.expiringRootAndOpCount,
    lamports: lamports(1_000_000n), // Rent-exempt amount
    data: expiringRootData,
    programAddress: mcmProgram,
    executable: false,
    space: BigInt(expiringRootData.length),
  };

  const rootMetadataData = encodeRootMetadata(rootMetadataOverride);
  const rootMetadataAccount: EncodedAccount = {
    address: pdas.rootMetadata,
    lamports: lamports(1_000_000n), // Rent-exempt amount
    data: rootMetadataData,
    programAddress: mcmProgram,
    executable: false,
    space: BigInt(rootMetadataData.length),
  };

  // Build the Simulation object
  return {
    payer: (): PayerConfig => ({
      address: authority,
      airdropAmount: !config.authority ? 100_000_000_000n : undefined, // Airdrop only if authority not provided
    }),

    accountsToLoad: () => {
      const accounts: Address[] = [mcmProgram, pdas.multisigConfig, pdas.multisigSigner];

      // Only load authority from RPC if it was explicitly provided
      if (config.authority) {
        accounts.push(authority);
      }

      // Add all program IDs and accounts from instructions
      for (const ix of proposal.instructions) {
        accounts.push(ix.programId);
        for (const acc of ix.accounts) {
          accounts.push(acc.pubkey);
        }
      }

      // Remove duplicates
      return Array.from(new Set(accounts));
    },

    accountOverrides: () => [
      [pdas.expiringRootAndOpCount, expiringRootAccount],
      [pdas.rootMetadata, rootMetadataAccount],
    ],

    clockTimestamp: () => {
      // Set time to 1 hour before expiration
      return BigInt(proposal.validUntil - 3600);
    },

    batches: () => {
      return proposal.instructions.map((ix, i) => {
        const nonce = proposal.rootMetadata.preOpCount + BigInt(i);

        const args: ExecuteArgs = {
          multisigId: proposal.multisigId,
          chainId: proposal.rootMetadata.chainId,
          nonce,
          data: ix.data,
          proof: operationProofs[i],
        };

        const instruction = buildExecuteInstruction({
          mcmProgram,
          pdas,
          args,
          to: ix.programId,
          remainingAccounts: ix.accounts.map(acc => ({
            pubkey: acc.pubkey,
            isSigner: acc.isSigner,
            isWritable: acc.isWritable,
          })),
          authority,
        });

        return [instruction];
      });
    },

    accountsToTrack: batchIndex => {
      const tracked = new Set<Address>([
        pdas.multisigConfig,
        pdas.rootMetadata,
        pdas.expiringRootAndOpCount,
        authority, // Track fee payer to capture transaction fees
      ]);

      // Add accounts from current instruction
      if (batchIndex < proposal.instructions.length) {
        const ix = proposal.instructions[batchIndex];
        for (const acc of ix.accounts) {
          tracked.add(acc.pubkey);
        }
      }

      return tracked;
    },
  };
};
