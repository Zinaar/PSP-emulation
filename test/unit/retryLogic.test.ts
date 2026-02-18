import { TransactionService } from '../../src/services/transactionService';
import { InMemoryTransactionRepository } from '../../src/repositories/inMemoryTransactionRepository';

/**
 * Tests for PSP call retry logic with exponential backoff.
 * Uses mocked `fetch` to simulate transient and permanent failures.
 */
describe('TransactionService - PSP Retry Logic', () => {
    let service: TransactionService;
    let repository: InMemoryTransactionRepository;
    const originalFetch = global.fetch;

    beforeEach(() => {
        repository = new InMemoryTransactionRepository();
        service = new TransactionService(repository, {
            pspBaseUrl: 'http://mock-psp',
            appBaseUrl: 'http://mock-app',
            retryAttempts: 3,
            retryDelayMs: 10, // Short delay for fast tests
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    const validPayload = {
        amount: 1000,
        currency: 'EUR',
        cardNumber: '5555111111111111',
        cardExpiry: '12/25',
        cvv: '123',
        orderId: 'order_retry_test',
    };

    it('should succeed on first attempt when PSP responds correctly', async () => {
        let callCount = 0;
        global.fetch = jest.fn(async () => {
            callCount++;
            return new Response(
                JSON.stringify({ transactionId: 'tx_abc', status: 'SUCCESS' }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
        });

        const result = await service.createTransaction(validPayload);
        expect(result.status).toBe('SUCCESS');
        expect(callCount).toBe(1);
    });

    it('should retry on 5xx errors and succeed when PSP recovers', async () => {
        let callCount = 0;
        global.fetch = jest.fn(async () => {
            callCount++;
            if (callCount < 3) {
                return new Response('Internal Server Error', { status: 500 });
            }
            return new Response(
                JSON.stringify({ transactionId: 'tx_retry_ok', status: 'SUCCESS' }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
        });

        const result = await service.createTransaction(validPayload);
        expect(result.status).toBe('SUCCESS');
        expect(callCount).toBe(3);
    });

    it('should retry on network errors and succeed when PSP recovers', async () => {
        let callCount = 0;
        global.fetch = jest.fn(async () => {
            callCount++;
            if (callCount < 2) {
                throw new TypeError('fetch failed');
            }
            return new Response(
                JSON.stringify({ transactionId: 'tx_net_ok', status: 'SUCCESS' }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
        });

        const result = await service.createTransaction(validPayload);
        expect(result.status).toBe('SUCCESS');
        expect(callCount).toBe(2);
    });

    it('should throw after exhausting all retry attempts on 5xx', async () => {
        let callCount = 0;
        global.fetch = jest.fn(async () => {
            callCount++;
            return new Response('Service Unavailable', { status: 503 });
        });

        await expect(service.createTransaction(validPayload)).rejects.toThrow(
            'PSP request failed after 3 attempts',
        );
        expect(callCount).toBe(3);
    });

    it('should NOT retry on 4xx client errors', async () => {
        let callCount = 0;
        global.fetch = jest.fn(async () => {
            callCount++;
            return new Response('Bad Request', { status: 400 });
        });

        await expect(service.createTransaction(validPayload)).rejects.toThrow(
            'PSP request failed with status 400',
        );
        expect(callCount).toBe(1);
    });

    it('should throw after exhausting all retry attempts on network errors', async () => {
        let callCount = 0;
        global.fetch = jest.fn(async () => {
            callCount++;
            throw new TypeError('fetch failed');
        });

        await expect(service.createTransaction(validPayload)).rejects.toThrow(
            'PSP request failed after 3 attempts',
        );
        expect(callCount).toBe(3);
    });
});
