import { FastifyInstance } from 'fastify';
import { WebhookError } from '../services/webhookService';

/**
 * Webhook routes - receives asynchronous callbacks from the PSP simulator.
 */
export default async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * POST /webhooks/psp
     * Receives webhook events from the PSP simulator.
     */
    fastify.post('/webhooks/psp', {
        schema: {
            tags: ['Webhooks'],
            summary: 'Receive PSP webhook',
            description: 'Processes asynchronous webhook events from the PSP simulator. Handles idempotency and state transitions.',
            body: {
                type: 'object',
                required: ['transactionId', 'status'],
                properties: {
                    transactionId: { type: 'string', description: 'PSP-assigned transaction ID', examples: ['tx_a1b2c3d4'] },
                    final_amount: { type: 'number', description: 'Final transaction amount from PSP', examples: [2500] },
                    status: { type: 'string', enum: ['SUCCESS', 'FAILED'], description: 'PSP transaction status', examples: ['SUCCESS'] },
                },
            },
        },
        handler: async (request, reply) => {
            try {
                const result = await fastify.webhookService.processWebhook(request.body as any);
                return { received: true, ...result };
            } catch (error) {
                if (error instanceof WebhookError) {
                    return reply.code(error.statusCode).send({
                        error: error.message,
                    });
                }
                const errorMessage = error instanceof Error ? error.message : String(error);
                fastify.log.error(error, 'Webhook processing failed');
                return reply.code(500).send({
                    error: 'Webhook processing failed',
                    message: errorMessage,
                });
            }
        },
    });
}
