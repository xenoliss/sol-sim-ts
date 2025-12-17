import { keccak_256 } from '@noble/hashes/sha3.js';
import { getAddressEncoder } from '@solana/kit';
import type { MerkleProof, Proposal, ProposalInstruction, ProposalWithRoot } from './types';

// Domain separators
const DOMAIN_SEPARATOR_METADATA = new Uint8Array(
  keccak_256(new TextEncoder().encode('MANY_CHAIN_MULTI_SIG_DOMAIN_SEPARATOR_METADATA_SOLANA'))
);
const DOMAIN_SEPARATOR_OP = new Uint8Array(
  keccak_256(new TextEncoder().encode('MANY_CHAIN_MULTI_SIG_DOMAIN_SEPARATOR_OP_SOLANA'))
);

/**
 * Left-pad a number to 32 bytes (big-endian)
 */
const padU64To32Bytes = (value: bigint): Uint8Array => {
  const bytes = new Uint8Array(32);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(24, value, true); // Little-endian, offset 24 (32 - 8)
  return bytes;
};

/**
 * Left-pad a boolean to 32 bytes
 */
const padBoolTo32Bytes = (value: boolean): Uint8Array => {
  const bytes = new Uint8Array(32);
  bytes[31] = value ? 1 : 0;
  return bytes;
};

/**
 * Hash the metadata leaf
 */
export const hashMetadataLeaf = (proposal: Proposal): Uint8Array => {
  const addressEncoder = getAddressEncoder();
  const multisigBytes = new Uint8Array(addressEncoder.encode(proposal.rootMetadata.multisig));

  // Concatenate all fields
  const parts: Uint8Array[] = [
    DOMAIN_SEPARATOR_METADATA,
    padU64To32Bytes(proposal.rootMetadata.chainId),
    multisigBytes,
    padU64To32Bytes(proposal.rootMetadata.preOpCount),
    padU64To32Bytes(proposal.rootMetadata.postOpCount),
    padBoolTo32Bytes(proposal.rootMetadata.overridePreviousRoot),
  ];

  // Calculate total length
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const concatenated = new Uint8Array(totalLength);

  let offset = 0;
  for (const part of parts) {
    concatenated.set(part, offset);
    offset += part.length;
  }

  return keccak_256(concatenated);
};

/**
 * Hash an operation leaf
 */
export const hashOperationLeaf = (
  proposal: Proposal,
  instruction: ProposalInstruction,
  nonce: bigint
): Uint8Array => {
  const addressEncoder = getAddressEncoder();
  const multisigBytes = new Uint8Array(addressEncoder.encode(proposal.rootMetadata.multisig));
  const programIdBytes = new Uint8Array(addressEncoder.encode(instruction.programId));

  // Serialize remaining accounts
  const serializedAccounts = new Uint8Array(instruction.accounts.length * 33);
  for (let i = 0; i < instruction.accounts.length; i++) {
    const acc = instruction.accounts[i];
    const accBytes = new Uint8Array(addressEncoder.encode(acc.pubkey));
    serializedAccounts.set(accBytes, i * 33);

    // Flags byte: bit 1 = isSigner (0x02), bit 0 = isWritable (0x01)
    let flags = 0;
    if (acc.isSigner) flags |= 0x02;
    if (acc.isWritable) flags |= 0x01;
    serializedAccounts[i * 33 + 32] = flags;
  }

  // Concatenate all fields
  const parts: Uint8Array[] = [
    DOMAIN_SEPARATOR_OP,
    padU64To32Bytes(proposal.rootMetadata.chainId),
    multisigBytes,
    padU64To32Bytes(nonce),
    programIdBytes,
    padU64To32Bytes(BigInt(instruction.data.length)),
    instruction.data,
    padU64To32Bytes(BigInt(instruction.accounts.length)),
    serializedAccounts,
  ];

  // Calculate total length
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const concatenated = new Uint8Array(totalLength);

  let offset = 0;
  for (const part of parts) {
    concatenated.set(part, offset);
    offset += part.length;
  }

  return keccak_256(concatenated);
};

/**
 * Build merkle tree from leaves and compute root + proofs
 */
const buildMerkleTree = (leaves: Uint8Array[]): { root: Uint8Array; proofs: MerkleProof[] } => {
  if (leaves.length === 0) {
    throw new Error('Cannot build merkle tree with no leaves');
  }

  // Build tree bottom-up
  let currentLevel = leaves.map(leaf => leaf);
  const tree: Uint8Array[][] = [currentLevel];

  while (currentLevel.length > 1) {
    const nextLevel: Uint8Array[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        // Pair exists - hash them together (sorted)
        const left = currentLevel[i];
        const right = currentLevel[i + 1];

        // Sort the pair
        const [first, second] =
          Buffer.compare(Buffer.from(left), Buffer.from(right)) < 0 ? [left, right] : [right, left];

        const combined = new Uint8Array(first.length + second.length);
        combined.set(first, 0);
        combined.set(second, first.length);

        nextLevel.push(keccak_256(combined));
      } else {
        // Odd one out - promote to next level
        nextLevel.push(currentLevel[i]);
      }
    }

    tree.push(nextLevel);
    currentLevel = nextLevel;
  }

  const root = tree[tree.length - 1][0];

  // Generate proofs for each leaf
  const proofs: MerkleProof[] = [];
  for (let leafIndex = 0; leafIndex < leaves.length; leafIndex++) {
    const proof: Uint8Array[] = [];
    let index = leafIndex;

    for (let level = 0; level < tree.length - 1; level++) {
      const levelNodes = tree[level];
      const isRightNode = index % 2 === 1;

      if (isRightNode) {
        // We're on the right, sibling is on the left
        proof.push(levelNodes[index - 1]);
      } else {
        // We're on the left, sibling is on the right (if exists)
        if (index + 1 < levelNodes.length) {
          proof.push(levelNodes[index + 1]);
        }
      }

      index = Math.floor(index / 2);
    }

    proofs.push(proof);
  }

  return { root, proofs };
};

/**
 * Compute merkle root and proofs for a proposal
 */
export const computeMerkleRoot = (proposal: Proposal): ProposalWithRoot => {
  // Leaf 0: Metadata leaf
  const metadataLeaf = hashMetadataLeaf(proposal);

  // Leaves 1..N: Operation leaves
  const operationLeaves = proposal.instructions.map((ix, i) => {
    const nonce = proposal.rootMetadata.preOpCount + BigInt(i);
    return hashOperationLeaf(proposal, ix, nonce);
  });

  // All leaves
  const allLeaves = [metadataLeaf, ...operationLeaves];

  // Build merkle tree
  const { root, proofs } = buildMerkleTree(allLeaves);

  // Operation proofs (exclude metadata proof at index 0)
  const operationProofs = proofs.slice(1);

  return {
    proposal,
    root,
    operationProofs,
  };
};
