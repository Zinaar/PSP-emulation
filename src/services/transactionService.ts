import { v4 as uuidv4 } from 'uuid';
import { STATUSES, TransactionStatus } from '../enums/transactionStatus';
import { assertTransition } from '../domain/transactionStateMachine';
import {
    ITransactionRepository,
    CreateTransactionPayload,
    CreateTransactionResponse,
    PspResponse,
} from '../types/transaction';

/**
 * Service responsible for creating transactions and coordinating with the PSP.
 */
export class TransactionService {
    private repository: ITransactionRepository;
    private pspBaseUrl: string;
    private appBaseUrl: string;
    private retryAttempts: number;
    private retryDelayMs: number;

    constructor(
        repository: ITransactionRepository,
        options: {
            pspBaseUrl: string;
            appBaseUrl: string;
            retryAttempts?: number;
            retryDelayMs?: number;
        },
    ) {
        this.repository = repository;
        this.pspBaseUrl = options.pspBaseUrl;
        this.appBaseUrl = options.appBaseUrl;
        this.retryAttempts = options.retryAttempts ?? 3;
        this.retryDelayMs = options.retryDelayMs ?? 500;
    }

    /**
     * Creates a new transaction and forwards it to the PSP simulator.
     *
     * Flow:
     * 1. Generate internal UUID
     * 2. Persist transaction with CREATED status
     * 3. Call PSP simulator (with retry)
     * 4. Map PSP response to internal status
     * 5. Return transaction with current state
     */
    async createTransaction(payload: CreateTransactionPayload): Promise<CreateTransactionResponse> {
        const { amount, currency, cardNumber, cardExpiry, cvv, orderId, callbackUrl } = payload;

        const transactionId = uuidv4();

        // Persist transaction in CREATED state
        let transaction = await this.repository.create({
            id: transactionId,
            orderId,
            amount,
            currency,
            cardNumber,
            status: STATUSES.CREATED,
        });

        // Call the PSP simulator
        const pspResponse = await this.callPsp({
            amount,
            currency,
            cardNumber,
            cardExpiry,
            cvv,
            orderId,
            callbackUrl: callbackUrl || `${this.appBaseUrl}/webhooks/psp`,
            failureUrl: `${this.appBaseUrl}/failure/psp`,
        });

        // Map PSP response status to internal status
        const statusMapping: Record<string, TransactionStatus> = {
            SUCCESS: STATUSES.SUCCESS,
            FAILED: STATUSES.FAILED,
            '3DS_REQUIRED': STATUSES.PENDING_3DS,
        };

        const newStatus = statusMapping[pspResponse.status];
        if (!newStatus) {
            throw new Error(`Unknown PSP status: ${pspResponse.status}`);
        }

        // Validate and apply state transition
        assertTransition(transaction.status, newStatus);

        transaction = await this.repository.updateStatus(transactionId, newStatus, {
            pspTransactionId: pspResponse.transactionId,
        });

        // Build response
        const response: CreateTransactionResponse = {
            id: transaction.id,
            orderId: transaction.orderId,
            amount: transaction.amount,
            currency: transaction.currency,
            status: transaction.status,
            pspTransactionId: transaction.pspTransactionId!,
        };

        if (pspResponse.threeDsRedirectUrl) {
            response.threeDsRedirectUrl = pspResponse.threeDsRedirectUrl;
        }

        return response;
    }

    /**
     * Retrieves a transaction by its internal ID.
     */
    async getTransaction(transactionId: string) {
        return this.repository.findById(transactionId);
    }

    /**
     * Determines whether a failed PSP request should be retried.
     * Only network errors and server errors (5xx) are retryable.
     * Client errors (4xx) indicate permanent failures and should not be retried.
     */
    private isRetryable(error: unknown): boolean {
        // Network errors (fetch throws TypeError on connection failure)
        if (error instanceof TypeError) {
            return true;
        }

        // Server errors (5xx) — thrown by callPsp as PspRequestError
        if (error instanceof Error && error.message.includes('status 5')) {
            return true;
        }

        return false;
    }

    /**
     * Sleeps for the specified number of milliseconds.
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Calls the PSP simulator's transaction endpoint with exponential backoff retry.
     * Retries on network errors and 5xx responses. 4xx errors are not retried.
     *
     * @param payload - Request body to send to the PSP
     * @returns PSP response
     * @throws Error after all retry attempts are exhausted
     */
    private async callPsp(payload: Record<string, unknown>): Promise<PspResponse> {
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const response = await fetch(`${this.pspBaseUrl}/transactions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new Error(`PSP request failed with status ${response.status}: ${errorBody}`);
                }

                return response.json() as Promise<PspResponse>;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Don't retry non-retryable errors (e.g. 4xx)
                if (!this.isRetryable(error)) {
                    throw lastError;
                }

                // Don't wait after the last attempt
                if (attempt < this.retryAttempts) {
                    const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
                    console.warn(
                        `PSP call attempt ${attempt}/${this.retryAttempts} failed, retrying in ${delay}ms: ${lastError.message}`,
                    );
                    await this.sleep(delay);
                }
            }
        }

        throw new Error(
            `PSP request failed after ${this.retryAttempts} attempts: ${lastError?.message}`,
        );
    }
}
