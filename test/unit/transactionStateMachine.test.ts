import { canTransition, assertTransition, isTerminalStatus } from '../../src/domain/transactionStateMachine';
import { STATUSES, TransactionStatus } from '../../src/enums/transactionStatus';

describe('Transaction State Machine', () => {
    describe('canTransition', () => {
        // Valid transitions from CREATED
        it('should allow transition from CREATED to PENDING_3DS', () => {
            expect(canTransition(STATUSES.CREATED, STATUSES.PENDING_3DS)).toBe(true);
        });

        it('should allow transition from CREATED to SUCCESS', () => {
            expect(canTransition(STATUSES.CREATED, STATUSES.SUCCESS)).toBe(true);
        });

        it('should allow transition from CREATED to FAILED', () => {
            expect(canTransition(STATUSES.CREATED, STATUSES.FAILED)).toBe(true);
        });

        // Valid transitions from PENDING_3DS
        it('should allow transition from PENDING_3DS to SUCCESS', () => {
            expect(canTransition(STATUSES.PENDING_3DS, STATUSES.SUCCESS)).toBe(true);
        });

        it('should allow transition from PENDING_3DS to FAILED', () => {
            expect(canTransition(STATUSES.PENDING_3DS, STATUSES.FAILED)).toBe(true);
        });

        // Invalid transitions from terminal states
        it('should reject transition from SUCCESS to any state', () => {
            expect(canTransition(STATUSES.SUCCESS, STATUSES.CREATED)).toBe(false);
            expect(canTransition(STATUSES.SUCCESS, STATUSES.PENDING_3DS)).toBe(false);
            expect(canTransition(STATUSES.SUCCESS, STATUSES.FAILED)).toBe(false);
        });

        it('should reject transition from FAILED to any state', () => {
            expect(canTransition(STATUSES.FAILED, STATUSES.CREATED)).toBe(false);
            expect(canTransition(STATUSES.FAILED, STATUSES.PENDING_3DS)).toBe(false);
            expect(canTransition(STATUSES.FAILED, STATUSES.SUCCESS)).toBe(false);
        });

        // Invalid backward transitions
        it('should reject transition from PENDING_3DS back to CREATED', () => {
            expect(canTransition(STATUSES.PENDING_3DS, STATUSES.CREATED)).toBe(false);
        });

        it('should reject transition from CREATED to CREATED', () => {
            expect(canTransition(STATUSES.CREATED, STATUSES.CREATED)).toBe(false);
        });
    });

    describe('assertTransition', () => {
        it('should not throw for valid transitions', () => {
            expect(() => assertTransition(STATUSES.CREATED, STATUSES.SUCCESS)).not.toThrow();
            expect(() => assertTransition(STATUSES.PENDING_3DS, STATUSES.SUCCESS)).not.toThrow();
        });

        it('should throw for invalid transitions with descriptive message', () => {
            expect(() => assertTransition(STATUSES.SUCCESS, STATUSES.CREATED)).toThrow(
                "Invalid state transition from 'SUCCESS' to 'CREATED'",
            );
        });

        it('should throw for transitions from terminal states', () => {
            expect(() => assertTransition(STATUSES.FAILED, STATUSES.SUCCESS)).toThrow(
                "Invalid state transition from 'FAILED' to 'SUCCESS'",
            );
        });
    });

    describe('isTerminalStatus', () => {
        it('should return true for SUCCESS', () => {
            expect(isTerminalStatus(STATUSES.SUCCESS)).toBe(true);
        });

        it('should return true for FAILED', () => {
            expect(isTerminalStatus(STATUSES.FAILED)).toBe(true);
        });

        it('should return false for CREATED', () => {
            expect(isTerminalStatus(STATUSES.CREATED)).toBe(false);
        });

        it('should return false for PENDING_3DS', () => {
            expect(isTerminalStatus(STATUSES.PENDING_3DS)).toBe(false);
        });
    });
});
