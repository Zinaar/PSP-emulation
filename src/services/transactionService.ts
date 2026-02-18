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

    constructor(
        repository: ITransactionRepository,
        options: { pspBaseUrl: string; appBaseUrl: string },
    ) {
        this.repository = repository;
        this.pspBaseUrl = options.pspBaseUrl;
        this.appBaseUrl = options.appBaseUrl;
    }

    /**
     * Creates a new transaction and forwards it to the PSP simulator.
     *
     * Flow:
     * 1. Generate internal UUID
     * 2. Persist transaction with CREATED status
     * 3. Call PSP simulator
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
     * Calls the PSP simulator's transaction endpoint.
     */
    private async callPsp(payload: Record<string, unknown>): Promise<PspResponse> {
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
    }
}
