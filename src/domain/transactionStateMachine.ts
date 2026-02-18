import { TransactionStatus, STATUSES } from '../enums/transactionStatus';

/**
 * Valid state transitions for transactions.
 * Terminal states (SUCCESS, FAILED) have no outgoing transitions.
 */
const VALID_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
    [STATUSES.CREATED]: [STATUSES.PENDING_3DS, STATUSES.SUCCESS, STATUSES.FAILED],
    [STATUSES.PENDING_3DS]: [STATUSES.SUCCESS, STATUSES.FAILED],
    [STATUSES.SUCCESS]: [],
    [STATUSES.FAILED]: [],
};

/**
 * Checks whether a state transition is valid.
 * @param fromStatus - Current transaction status
 * @param toStatus - Target transaction status
 * @returns True if the transition is allowed
 */
export function canTransition(fromStatus: TransactionStatus, toStatus: TransactionStatus): boolean {
    const allowedTransitions = VALID_TRANSITIONS[fromStatus];
    if (!allowedTransitions) {
        return false;
    }
    return allowedTransitions.includes(toStatus);
}

/**
 * Asserts that a state transition is valid, throwing an error if not.
 * @param fromStatus - Current transaction status
 * @param toStatus - Target transaction status
 * @throws Error if the transition is invalid
 */
export function assertTransition(fromStatus: TransactionStatus, toStatus: TransactionStatus): void {
    if (!canTransition(fromStatus, toStatus)) {
        throw new Error(`Invalid state transition from '${fromStatus}' to '${toStatus}'`);
    }
}

/**
 * Checks whether a status is a terminal state (no further transitions possible).
 * @param status - Transaction status to check
 * @returns True if the status is terminal
 */
export function isTerminalStatus(status: TransactionStatus): boolean {
    return status === STATUSES.SUCCESS || status === STATUSES.FAILED;
}
