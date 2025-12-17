import type { Address } from '@solana/kit';
import type { Account, Simulation } from '../litesim/index.js';
import { buildExecuteInstruction, type ExecuteArgs } from './program/instruction.js';
import { deriveMcmPdas } from './program/pda.js';
import {
  encodeExpiringRootAndOpCount,
  encodeRootMetadata,
  type ExpiringRootAndOpCount,
  type RootMetadata,
} from './program/accounts.js';
import type { ProposalWithRoot } from './proposal/types.js';

/**
 * MCM simulation configuration
 */
export type McmSimulationConfig = {
  proposalWithRoot: ProposalWithRoot;
  mcmProgram: Address;
  authority: Address;
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
export const createMcmSimulation = async (
  config: McmSimulationConfig
): Promise<Simulation> => {
  const { proposalWithRoot, mcmProgram, authority } = config;
  const { proposal, root, operationProofs } = proposalWithRoot;

  // Derive PDAs
  const pdas = await deriveMcmPdas(mcmProgram, proposal.multisigId);

  // Create mocked accounts
  const mockedExpiringRoot: ExpiringRootAndOpCount = {
    root,
    validUntil: proposal.validUntil,
    opCount: proposal.rootMetadata.preOpCount,
  };

  const mockedRootMetadata: RootMetadata = {
    chainId: proposal.rootMetadata.chainId,
    multisig: proposal.rootMetadata.multisig,
    preOpCount: proposal.rootMetadata.preOpCount,
    postOpCount: proposal.rootMetadata.postOpCount,
    overridePreviousRoot: proposal.rootMetadata.overridePreviousRoot,
  };

  const expiringRootAccount: Account = {
    lamports: 1_000_000n, // Rent-exempt amount
    data: encodeExpiringRootAndOpCount(mockedExpiringRoot),
    owner: mcmProgram,
    executable: false,
    rentEpoch: 0n,
  };

  const rootMetadataAccount: Account = {
    lamports: 1_000_000n, // Rent-exempt amount
    data: encodeRootMetadata(mockedRootMetadata),
    owner: mcmProgram,
    executable: false,
    rentEpoch: 0n,
  };

  // Build the Simulation object
  return {
    payer: () => authority,

    accounts: () => {
      const accounts: Address[] = [mcmProgram, pdas.multisigConfig, pdas.multisigSigner];

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

    mockedAccounts: () => [
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
          remainingAccounts: ix.accounts.map((acc) => ({
            pubkey: acc.pubkey,
            isSigner: acc.isSigner,
            isWritable: acc.isWritable,
          })),
          authority,
        });

        return [instruction];
      });
    },

    trackedAccounts: (batchIndex) => {
      const tracked = new Set<Address>([
        pdas.multisigConfig,
        pdas.rootMetadata,
        pdas.expiringRootAndOpCount,
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
