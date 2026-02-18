/**
 * Transaction statuses used by the application.
 * These are the internal statuses managed by our system.
 */
export const STATUSES = {
    CREATED: 'CREATED',
    PENDING_3DS: 'PENDING_3DS',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
} as const;

export type TransactionStatus = (typeof STATUSES)[keyof typeof STATUSES];
