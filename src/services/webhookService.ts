import { TransactionStatus } from '../enums/transactionStatus';
import { assertTransition, isTerminalStatus } from '../domain/transactionStateMachine';
import { ITransactionRepository, WebhookPayload, WebhookResult } from '../types/transaction';

/**
 * PSP status to internal status mapping.
 */
const PSP_STATUS_MAP: Record<string, TransactionStatus> = {
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
};

/**
 * Custom error class for webhook processing errors with HTTP status codes.
 */
export class WebhookError extends Error {
    public statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = 'WebhookError';
        this.statusCode = statusCode;
    }
}

/**
 * Service responsible for processing incoming webhooks from the PSP.
 */
export class WebhookService {
    private repository: ITransactionRepository;

    constructor(repository: ITransactionRepository) {
        this.repository = repository;
    }

    /**
     * Processes a webhook callback from the PSP simulator.
     *
     * Uses database transactions with row locking (SELECT ... FOR UPDATE)
     * to safely handle concurrent webhooks:
     * - Status mapping from PSP to internal statuses
     * - Idempotency: duplicate webhooks with same terminal status are ignored
     * - State validation: invalid transitions are rejected
     * - Final amount storage from the PSP
     */
    async processWebhook(payload: WebhookPayload): Promise<WebhookResult> {
        const { transactionId: pspTransactionId, final_amount: finalAmount, status: pspStatus } = payload;

        // Map PSP status to internal status (do this before locking to fail fast)
        const newStatus = PSP_STATUS_MAP[pspStatus];
        if (!newStatus) {
            throw new WebhookError(`Unknown PSP status: ${pspStatus}`, 400);
        }

        // Acquire row lock: BEGIN + SELECT ... FOR UPDATE
        const lockedContext = await this.repository.findAndLockByPspTransactionId(pspTransactionId);

        try {
            const { transaction } = lockedContext;

            if (!transaction) {
                await lockedContext.rollback();
                throw new WebhookError(`Transaction not found for PSP ID: ${pspTransactionId}`, 404);
            }

            // Idempotency: if already in this terminal state, ignore the duplicate
            if (isTerminalStatus(transaction.status) && transaction.status === newStatus) {
                await lockedContext.commit();
                return {
                    id: transaction.id,
                    status: transaction.status,
                    message: 'Duplicate webhook ignored',
                };
            }

            // Validate the state transition
            try {
                assertTransition(transaction.status, newStatus);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                await lockedContext.rollback();
                throw new WebhookError(
                    `Invalid transition for transaction ${transaction.id}: ${errorMessage}`,
                    409,
                );
            }

            // Apply the status update with final amount (inside the same DB transaction)
            const updatedTransaction = await lockedContext.updateStatus(newStatus, {
                finalAmount,
            });

            // Commit the database transaction
            await lockedContext.commit();

            return {
                id: updatedTransaction.id,
                status: updatedTransaction.status,
                finalAmount: updatedTransaction.finalAmount,
            };
        } catch (error) {
            // If error is already a WebhookError, it was already rolled back above
            if (!(error instanceof WebhookError)) {
                await lockedContext.rollback();
            }
            throw error;
        }
    }
}
