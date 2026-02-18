import { FastifyInstance } from 'fastify';

/**
 * Transaction routes - public API endpoints for transaction management.
 */
export default async function transactionRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * POST /transactions
     * Creates a new transaction and forwards it to the PSP simulator.
     */
    fastify.post('/transactions', {
        schema: {
            tags: ['Transactions'],
            summary: 'Create a new transaction',
            description: 'Validates the request, creates a transaction, and forwards it to the PSP simulator.',
            body: {
                type: 'object',
                required: ['amount', 'currency', 'cardNumber', 'cardExpiry', 'cvv', 'orderId'],
                properties: {
                    amount: { type: 'integer', minimum: 1, description: 'Amount in smallest currency unit (e.g. cents)', examples: [2500] },
                    currency: { type: 'string', minLength: 3, maxLength: 3, description: 'ISO 4217 currency code', examples: ['EUR'] },
                    cardNumber: {
                        type: 'string', minLength: 13, maxLength: 19,
                        description: 'Payment card number. Prefix determines outcome: 5555→Success, 4000→Failed, 4111→3DS',
                        examples: ['5555111111111111'],
                    },
                    cardExpiry: { type: 'string', pattern: '^\\d{2}/\\d{2}$', description: 'Card expiry date (MM/YY)', examples: ['12/26'] },
                    cvv: { type: 'string', minLength: 3, maxLength: 4, description: 'Card CVV code', examples: ['123'] },
                    orderId: { type: 'string', minLength: 1, description: 'Unique order identifier', examples: ['order_001'] },
                    callbackUrl: { type: 'string', format: 'uri', description: 'Webhook callback URL (optional)', examples: ['http://localhost:3000/webhooks/psp'] },
                },
            },
        },
        handler: async (request, reply) => {
            try {
                const result = await fastify.transactionService.createTransaction(request.body as any);
                return result;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                fastify.log.error(error, 'Failed to create transaction');
                return reply.code(500).send({
                    error: 'Transaction creation failed',
                    message: errorMessage,
                });
            }
        },
    });

    /**
     * GET /transactions/:id
     * Retrieves a transaction by its internal ID.
     */
    fastify.get('/transactions/:id', {
        schema: {
            tags: ['Transactions'],
            summary: 'Get transaction by ID',
            description: 'Retrieves the current state of a transaction.',
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string', format: 'uuid', examples: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'] },
                },
            },
        },
        handler: async (request, reply) => {
            const { id } = request.params as { id: string };
            const transaction = await fastify.transactionService.getTransaction(id);
            if (!transaction) {
                return reply.code(404).send({ error: 'Transaction not found' });
            }
            return transaction;
        },
    });
}
