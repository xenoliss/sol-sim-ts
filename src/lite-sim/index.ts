/**
 * lite-sim - Lightweight Solana transaction simulator
 *
 * A generic, reusable framework for simulating Solana transactions
 * with signature verification disabled and account mutation tracking.
 */

// Core types
export type { AccountMutation } from './mutations';
export type { BatchResult, SimulationResults, SimulatorContext } from './simulator';
export type { Simulation, PayerConfig } from './simulation';

// Main simulator API
export { createSimulator, runSimulation } from './simulator';
