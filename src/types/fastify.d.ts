import { Pool } from 'pg';
import { TransactionService } from './services/transactionService';
import { WebhookService } from './services/webhookService';

/**
 * Augment Fastify instance with our custom decorators.
 */
declare module 'fastify' {
    interface FastifyInstance {
        pg: Pool;
        transactionService: TransactionService;
        webhookService: WebhookService;
    }
}
