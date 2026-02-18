import { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildApp';
import { InMemoryTransactionRepository } from '../../src/repositories/inMemoryTransactionRepository';

describe('POST /transactions', () => {
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

    const buildValidPayload = (cardNumber: string) => ({
        amount: 1000,
        currency: 'EUR',
        cardNumber,
        cardExpiry: '12/25',
        cvv: '123',
        orderId: `order_${Date.now()}`,
        callbackUrl: 'http://localhost:3000/webhooks/psp',
    });

    it('should create a successful transaction with card prefix 5555', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/transactions',
            payload: buildValidPayload('5555111111111111'),
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.status).toBe('SUCCESS');
        expect(body.id).toBeDefined();
        expect(body.pspTransactionId).toBeDefined();
        expect(body.amount).toBe(1000);
        expect(body.currency).toBe('EUR');
    });

    it('should create a failed transaction with card prefix 4000', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/transactions',
            payload: buildValidPayload('4000111111111111'),
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.status).toBe('FAILED');
        expect(body.id).toBeDefined();
    });

    it('should create a PENDING_3DS transaction with card prefix 4111', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/transactions',
            payload: buildValidPayload('4111111111111111'),
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.status).toBe('PENDING_3DS');
        expect(body.threeDsRedirectUrl).toBeDefined();
        expect(body.threeDsRedirectUrl).toContain('/psp/3ds/');
    });

    it('should reject requests with missing required fields', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/transactions',
            payload: {
                amount: 1000,
                // Missing other required fields
            },
        });

        expect(response.statusCode).toBe(400);
    });

    it('should reject requests with invalid amount', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/transactions',
            payload: {
                ...buildValidPayload('5555111111111111'),
                amount: 0,
            },
        });

        expect(response.statusCode).toBe(400);
    });

    it('should reject requests with invalid currency length', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/transactions',
            payload: {
                ...buildValidPayload('5555111111111111'),
                currency: 'EURO',
            },
        });

        expect(response.statusCode).toBe(400);
    });

    it('should reject requests with invalid card expiry format', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/transactions',
            payload: {
                ...buildValidPayload('5555111111111111'),
                cardExpiry: '2025-12',
            },
        });

        expect(response.statusCode).toBe(400);
    });

    it('should persist the transaction in the repository', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/transactions',
            payload: buildValidPayload('5555111111111111'),
        });

        const body = response.json();
        const storedTransaction = await repository.findById(body.id);
        expect(storedTransaction).not.toBeNull();
        expect(storedTransaction!.status).toBe('SUCCESS');
        expect(storedTransaction!.pspTransactionId).toBeDefined();
    });
});

describe('GET /transactions/:id', () => {
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

    it('should return 404 for non-existent transaction', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/transactions/00000000-0000-0000-0000-000000000000',
        });

        expect(response.statusCode).toBe(404);
        const body = response.json();
        expect(body.error).toBe('Transaction not found');
    });

    it('should return an existing transaction', async () => {
        // First create a transaction
        const createResponse = await app.inject({
            method: 'POST',
            url: '/transactions',
            payload: {
                amount: 2000,
                currency: 'USD',
                cardNumber: '5555111111111111',
                cardExpiry: '12/25',
                cvv: '456',
                orderId: 'order_get_test',
                callbackUrl: 'http://localhost:3000/webhooks/psp',
            },
        });

        const createdTransaction = createResponse.json();

        // Then retrieve it
        const getResponse = await app.inject({
            method: 'GET',
            url: `/transactions/${createdTransaction.id}`,
        });

        expect(getResponse.statusCode).toBe(200);
        const body = getResponse.json();
        expect(body.id).toBe(createdTransaction.id);
        expect(body.amount).toBe(2000);
        expect(body.currency).toBe('USD');
        expect(body.status).toBe('SUCCESS');
    });
});
