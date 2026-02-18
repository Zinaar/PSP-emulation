import Fastify, { FastifyInstance } from 'fastify';
import { ITransactionRepository } from './types/transaction';
import { TransactionService } from './services/transactionService';
import { WebhookService } from './services/webhookService';
import { TransactionRepository } from './repositories/transactionRepository';
import swaggerPlugin from './plugins/swagger';
import databasePlugin from './plugins/database';
import transactionRoutes from './routes/transactions';
import webhookRoutes from './routes/webhooks';
import pspRoutes from './psp-simulator/pspRoutes';
import config from './config';

/**
 * Options for building the Fastify application.
 * `repository` can be provided to override the default Postgres repository (useful for testing).
 */
export interface BuildAppOptions {
    logger?: boolean | object;
    repository?: ITransactionRepository;
    skipDatabase?: boolean;
    pspBaseUrl?: string;
    appBaseUrl?: string;
}

/**
 * Creates and configures the Fastify application.
 * Registers all plugins, services, and routes.
 *
 * @param options - Application build options
 * @returns Configured Fastify instance
 */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
    const { logger = true, repository, skipDatabase = false } = options;

    const app = Fastify({ logger });

    // Register Swagger documentation plugin
    await app.register(swaggerPlugin);

    // Register database plugin (skip for tests using in-memory repository)
    if (!skipDatabase) {
        await app.register(databasePlugin, { databaseUrl: config.databaseUrl });
    }

    // Create repository (use provided one or default to Postgres)
    const transactionRepository: ITransactionRepository =
        repository || new TransactionRepository(app.pg);

    // Register services as decorators for route access
    const transactionService = new TransactionService(transactionRepository, {
        pspBaseUrl: options.pspBaseUrl || config.pspBaseUrl,
        appBaseUrl: options.appBaseUrl || config.appBaseUrl,
        retryAttempts: config.pspRetryAttempts,
        retryDelayMs: config.pspRetryDelayMs,
    });

    const webhookService = new WebhookService(transactionRepository);

    app.decorate('transactionService', transactionService);
    app.decorate('webhookService', webhookService);

    // Register routes
    await app.register(transactionRoutes);
    await app.register(webhookRoutes);
    await app.register(pspRoutes);

    return app;
}

