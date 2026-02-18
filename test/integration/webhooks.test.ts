import { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildApp';
import { InMemoryTransactionRepository } from '../../src/repositories/inMemoryTransactionRepository';
import { STATUSES } from '../../src/enums/transactionStatus';

describe('POST /webhooks/psp', () => {
    let app: FastifyInstance;
    let repository: InMemoryTransactionRepository;

    beforeAll(async () => {
        const testApp = await buildTestApp();
        app = testApp.app;
        repository = testApp.repository;
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        repository.clear();
    });

    /**
     * Helper: creates a transaction in the repository with the given status and PSP ID.
     */
    async function createTestTransaction(
        status: string,
        pspTransactionId: string = 'tx_test123',
    ): Promise<string> {
        const transaction = await repository.create({
            id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            orderId: 'order_test',
            amount: 1000,
            currency: 'EUR',
            cardNumber: '5555111111111111',
            status: status as any,
        });

        await repository.updateStatus(transaction.id, status as any, {
            pspTransactionId,
        });

        return transaction.id;
    }

    it('should process a SUCCESS webhook and update transaction status', async () => {
        await createTestTransaction(STATUSES.CREATED, 'tx_webhook_success');

        const response = await app.inject({
            method: 'POST',
            url: '/webhooks/psp',
            payload: {
                transactionId: 'tx_webhook_success',
                final_amount: 1000,
                status: 'SUCCESS',
            },
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.received).toBe(true);
        expect(body.status).toBe('SUCCESS');

        // Verify the transaction was updated in the repository
        const updatedTransaction = await repository.findById('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
        expect(updatedTransaction!.status).toBe('SUCCESS');
        expect(updatedTransaction!.finalAmount).toBe(1000);
    });

    it('should process a FAILED webhook and update transaction status', async () => {
        await createTestTransaction(STATUSES.CREATED, 'tx_webhook_failed');

        const response = await app.inject({
            method: 'POST',
            url: '/webhooks/psp',
            payload: {
                transactionId: 'tx_webhook_failed',
                final_amount: 0,
                status: 'FAILED',
            },
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.received).toBe(true);
        expect(body.status).toBe('FAILED');
    });

    it('should handle duplicate SUCCESS webhooks idempotently', async () => {
        await createTestTransaction(STATUSES.SUCCESS, 'tx_duplicate');

        const response = await app.inject({
            method: 'POST',
            url: '/webhooks/psp',
            payload: {
                transactionId: 'tx_duplicate',
                final_amount: 1000,
                status: 'SUCCESS',
            },
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.received).toBe(true);
        expect(body.message).toBe('Duplicate webhook ignored');
    });

    it('should handle duplicate FAILED webhooks idempotently', async () => {
        await createTestTransaction(STATUSES.FAILED, 'tx_duplicate_failed');

        const response = await app.inject({
            method: 'POST',
            url: '/webhooks/psp',
            payload: {
                transactionId: 'tx_duplicate_failed',
                final_amount: 0,
                status: 'FAILED',
            },
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.message).toBe('Duplicate webhook ignored');
    });

    it('should reject invalid state transitions', async () => {
        await createTestTransaction(STATUSES.SUCCESS, 'tx_invalid_transition');

        const response = await app.inject({
            method: 'POST',
            url: '/webhooks/psp',
            payload: {
                transactionId: 'tx_invalid_transition',
                final_amount: 1000,
                status: 'FAILED',
            },
        });

        expect(response.statusCode).toBe(409);
        const body = response.json();
        expect(body.error).toContain('Invalid transition');
    });

    it('should return 404 for unknown PSP transaction ID', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/webhooks/psp',
            payload: {
                transactionId: 'tx_nonexistent',
                final_amount: 1000,
                status: 'SUCCESS',
            },
        });

        expect(response.statusCode).toBe(404);
        const body = response.json();
        expect(body.error).toContain('Transaction not found');
    });

    it('should process webhook for PENDING_3DS transaction', async () => {
        await createTestTransaction(STATUSES.PENDING_3DS, 'tx_3ds_complete');

        const response = await app.inject({
            method: 'POST',
            url: '/webhooks/psp',
            payload: {
                transactionId: 'tx_3ds_complete',
                final_amount: 1000,
                status: 'SUCCESS',
            },
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.status).toBe('SUCCESS');
    });

    it('should store the final_amount from the webhook', async () => {
        await createTestTransaction(STATUSES.CREATED, 'tx_final_amount');

        await app.inject({
            method: 'POST',
            url: '/webhooks/psp',
            payload: {
                transactionId: 'tx_final_amount',
                final_amount: 23,
                status: 'SUCCESS',
            },
        });

        const updatedTransaction = await repository.findById('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
        expect(updatedTransaction!.finalAmount).toBe(23);
    });
});
