import { buildApp } from '../../src/app';
import { InMemoryTransactionRepository } from '../../src/repositories/inMemoryTransactionRepository';
import { FastifyInstance } from 'fastify';

/**
 * Creates a test Fastify instance with in-memory repository.
 * Starts listening on a random available port so that internal
 * HTTP calls (e.g. TransactionService calling PSP simulator) work.
 */
export async function buildTestApp(): Promise<{
    app: FastifyInstance;
    repository: InMemoryTransactionRepository;
    baseUrl: string;
}> {
    const repository = new InMemoryTransactionRepository();

    // Use port 0 to get a random available port — we'll set the URLs after we know it
    const app = await buildApp({
        logger: false,
        repository,
        skipDatabase: true,
        // Temporary dummy values — will be overridden via hook below
        pspBaseUrl: 'http://placeholder',
        appBaseUrl: 'http://placeholder',
    });

    // Listen on a random port
    const address = await app.listen({ port: 0, host: '127.0.0.1' });

    // Now update the services with the actual URLs
    const transactionServiceAny = app.transactionService as any;
    transactionServiceAny.pspBaseUrl = `${address}/psp`;
    transactionServiceAny.appBaseUrl = address;

    return { app, repository, baseUrl: address };
}
