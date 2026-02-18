import { TransactionStatus } from '../enums/transactionStatus';

/**
 * Represents a transaction record as stored and returned by the repository.
 */
export interface TransactionRecord {
    id: string;
    orderId: string;
    amount: number;
    currency: string;
    cardNumber: string;
    status: TransactionStatus;
    pspTransactionId: string | null;
    finalAmount: number | null;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Data required to create a new transaction.
 */
export interface CreateTransactionData {
    id: string;
    orderId: string;
    amount: number;
    currency: string;
    cardNumber: string;
    status: TransactionStatus;
}

/**
 * Optional extra fields when updating a transaction status.
 */
export interface UpdateExtraFields {
    pspTransactionId?: string;
    finalAmount?: number;
}

/**
 * Interface for transaction storage operations.
 * Both Postgres and in-memory implementations conform to this contract.
 */
export interface ITransactionRepository {
    create(transactionData: CreateTransactionData): Promise<TransactionRecord>;
    findById(transactionId: string): Promise<TransactionRecord | null>;
    findByPspTransactionId(pspTransactionId: string): Promise<TransactionRecord | null>;
    updateStatus(transactionId: string, status: TransactionStatus, extraFields?: UpdateExtraFields): Promise<TransactionRecord>;

    /**
     * Atomically finds a transaction by PSP ID (with row lock) and applies a status update.
     * In Postgres this uses BEGIN + SELECT ... FOR UPDATE + UPDATE + COMMIT.
     * Returns the locked transaction and an updater function to apply the change.
     */
    findAndLockByPspTransactionId(
        pspTransactionId: string,
    ): Promise<{ transaction: TransactionRecord | null; updateStatus: (status: TransactionStatus, extraFields?: UpdateExtraFields) => Promise<TransactionRecord>; commit: () => Promise<void>; rollback: () => Promise<void> }>;
}

/**
 * Request payload for creating a transaction via the public API.
 */
export interface CreateTransactionPayload {
    amount: number;
    currency: string;
    cardNumber: string;
    cardExpiry: string;
    cvv: string;
    orderId: string;
    callbackUrl?: string;
}

/**
 * Response returned after creating a transaction.
 */
export interface CreateTransactionResponse {
    id: string;
    orderId: string;
    amount: number;
    currency: string;
    status: TransactionStatus;
    pspTransactionId: string;
    threeDsRedirectUrl?: string;
}

/**
 * Webhook payload received from the PSP simulator.
 */
export interface WebhookPayload {
    transactionId: string;
    final_amount: number;
    status: string;
}

/**
 * Result of processing a webhook.
 */
export interface WebhookResult {
    id: string;
    status: TransactionStatus;
    finalAmount?: number | null;
    message?: string;
}

/**
 * Response from the PSP simulator.
 */
export interface PspResponse {
    transactionId: string;
    status: string;
    threeDsRedirectUrl?: string;
}

/**
 * Request payload sent to the PSP simulator.
 */
export interface PspTransactionRequest {
    amount: number;
    currency: string;
    cardNumber: string;
    cardExpiry: string;
    cvv: string;
    orderId: string;
    callbackUrl: string;
    failureUrl: string;
}
