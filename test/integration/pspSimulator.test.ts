import { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildApp';
import { InMemoryTransactionRepository } from '../../src/repositories/inMemoryTransactionRepository';

describe('PSP Simulator', () => {
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

    describe('POST /psp/transactions', () => {
        it('should return SUCCESS for card prefix 5555', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/psp/transactions',
                payload: {
                    amount: 1000,
                    currency: 'EUR',
                    cardNumber: '5555111111111111',
                    cardExpiry: '12/25',
                    cvv: '123',
                    orderId: 'order_psp_success',
                    callbackUrl: 'http://localhost:3000/webhooks/psp',
                    failureUrl: 'http://localhost:3000/failure/psp',
                },
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.status).toBe('SUCCESS');
            expect(body.transactionId).toBeDefined();
            expect(body.transactionId).toMatch(/^tx_/);
        });

        it('should return FAILED for card prefix 4000', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/psp/transactions',
                payload: {
                    amount: 1000,
                    currency: 'EUR',
                    cardNumber: '4000111111111111',
                    cardExpiry: '12/25',
                    cvv: '123',
                    orderId: 'order_psp_failed',
                    callbackUrl: 'http://localhost:3000/webhooks/psp',
                    failureUrl: 'http://localhost:3000/failure/psp',
                },
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.status).toBe('FAILED');
            expect(body.transactionId).toBeDefined();
        });

        it('should return 3DS_REQUIRED for card prefix 4111 with redirect URL', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/psp/transactions',
                payload: {
                    amount: 1000,
                    currency: 'EUR',
                    cardNumber: '4111111111111111',
                    cardExpiry: '12/25',
                    cvv: '123',
                    orderId: 'order_psp_3ds',
                    callbackUrl: 'http://localhost:3000/webhooks/psp',
                    failureUrl: 'http://localhost:3000/failure/psp',
                },
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.status).toBe('3DS_REQUIRED');
            expect(body.threeDsRedirectUrl).toBeDefined();
            expect(body.threeDsRedirectUrl).toContain('/psp/3ds/');
        });

        it('should return FAILED for unknown card prefixes', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/psp/transactions',
                payload: {
                    amount: 1000,
                    currency: 'EUR',
                    cardNumber: '9999111111111111',
                    cardExpiry: '12/25',
                    cvv: '123',
                    orderId: 'order_psp_unknown',
                    callbackUrl: 'http://localhost:3000/webhooks/psp',
                    failureUrl: 'http://localhost:3000/failure/psp',
                },
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.status).toBe('FAILED');
        });
    });

    describe('GET /psp/3ds/:transactionId', () => {
        it('should return 404 for non-existent 3DS transaction', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/psp/3ds/tx_nonexistent',
            });

            expect(response.statusCode).toBe(404);
        });

        it('should return HTML confirmation page for valid 3DS transaction', async () => {
            // First create a 3DS transaction
            const createResponse = await app.inject({
                method: 'POST',
                url: '/psp/transactions',
                payload: {
                    amount: 1000,
                    currency: 'EUR',
                    cardNumber: '4111111111111111',
                    cardExpiry: '12/25',
                    cvv: '123',
                    orderId: 'order_3ds_page',
                    callbackUrl: 'http://localhost:3000/webhooks/psp',
                    failureUrl: 'http://localhost:3000/failure/psp',
                },
            });

            const { threeDsRedirectUrl } = createResponse.json();
            const pspTransactionId = threeDsRedirectUrl.split('/psp/3ds/')[1];

            // Access the 3DS page
            const threeDsResponse = await app.inject({
                method: 'GET',
                url: `/psp/3ds/${pspTransactionId}`,
            });

            expect(threeDsResponse.statusCode).toBe(200);
            expect(threeDsResponse.headers['content-type']).toContain('text/html');
            expect(threeDsResponse.body).toContain('3DS Verification Complete');
            expect(threeDsResponse.body).toContain(pspTransactionId);
        });

        it('should return 404 when accessing same 3DS transaction twice', async () => {
            // Create a 3DS transaction
            const createResponse = await app.inject({
                method: 'POST',
                url: '/psp/transactions',
                payload: {
                    amount: 1000,
                    currency: 'EUR',
                    cardNumber: '4111111111111111',
                    cardExpiry: '12/25',
                    cvv: '123',
                    orderId: 'order_3ds_double',
                    callbackUrl: 'http://localhost:3000/webhooks/psp',
                    failureUrl: 'http://localhost:3000/failure/psp',
                },
            });

            const { threeDsRedirectUrl } = createResponse.json();
            const pspTransactionId = threeDsRedirectUrl.split('/psp/3ds/')[1];

            // First access — should succeed
            await app.inject({
                method: 'GET',
                url: `/psp/3ds/${pspTransactionId}`,
            });

            // Second access — should return 404 (already consumed)
            const secondResponse = await app.inject({
                method: 'GET',
                url: `/psp/3ds/${pspTransactionId}`,
            });

            expect(secondResponse.statusCode).toBe(404);
        });
    });
});
