// Re-export of the TypeScript scoring module (migrated to src/scoring/).
// This shim keeps legacy callers in client/js/* working without changing their imports.
// New code should import directly from '@/scoring'.
export * from '../src/scoring/index.ts';
