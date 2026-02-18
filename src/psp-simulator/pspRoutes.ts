import { FastifyInstance } from 'fastify';
import { processTransaction, resolve3dsTransaction } from './pspService';
import { PspTransactionRequest } from '../types/transaction';

/**
 * PSP Simulator routes - mock Payment Service Provider endpoints.
 * These simulate external PSP behavior within the same Fastify process.
 */
export default async function pspRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * POST /psp/transactions
     * Simulates PSP transaction creation based on card number prefix rules.
     */
    fastify.post<{ Body: PspTransactionRequest }>('/psp/transactions', {
        schema: {
            tags: ['PSP Simulator'],
            summary: 'Create PSP transaction (simulator)',
            description: 'Simulates transaction creation. Card prefix determines outcome: 4111→3DS, 5555→Success, 4000→Failed.',
            body: {
                type: 'object',
                required: ['amount', 'currency', 'cardNumber', 'callbackUrl'],
                properties: {
                    amount: { type: 'integer', description: 'Transaction amount', examples: [2500] },
                    currency: { type: 'string', description: 'Currency code', examples: ['EUR'] },
                    cardNumber: { type: 'string', description: 'Card number (prefix determines outcome: 4111→3DS, 5555→Success, 4000→Failed)', examples: ['4111111111111111'] },
                    cardExpiry: { type: 'string', description: 'Card expiry date', examples: ['12/26'] },
                    cvv: { type: 'string', description: 'Card CVV', examples: ['123'] },
                    orderId: { type: 'string', description: 'Order identifier', examples: ['order_001'] },
                    callbackUrl: { type: 'string', description: 'Webhook callback URL', examples: ['http://localhost:3000/webhooks/psp'] },
                    failureUrl: { type: 'string', description: 'Failure redirect URL', examples: ['http://localhost:3000/failure/psp'] },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        transactionId: { type: 'string', examples: ['tx_a1b2c3d4'] },
                        status: { type: 'string', enum: ['SUCCESS', 'FAILED', '3DS_REQUIRED'], examples: ['3DS_REQUIRED'] },
                        threeDsRedirectUrl: { type: 'string', examples: ['http://localhost:3000/psp/3ds/tx_a1b2c3d4'] },
                    },
                },
            },
        },
        handler: async (request) => {
            const host = request.headers.host || request.hostname;
            const pspBaseUrl = `${request.protocol}://${host}/psp`;
            return processTransaction(request.body, pspBaseUrl);
        },
    });

    /**
     * GET /psp/3ds/:transactionId
     * Simulates the 3DS verification page.
     * After a delay, sends a webhook to complete the transaction.
     */
    fastify.get<{ Params: { transactionId: string } }>('/psp/3ds/:transactionId', {
        schema: {
            tags: ['PSP Simulator'],
            summary: 'Simulate 3DS verification page',
            description: 'Returns an HTML page simulating 3DS verification. After a delay, sends a SUCCESS webhook.',
            params: {
                type: 'object',
                required: ['transactionId'],
                properties: {
                    transactionId: { type: 'string', description: 'PSP transaction ID', examples: ['tx_a1b2c3d4'] },
                },
            },
        },
        handler: async (request, reply) => {
            const { transactionId: pspTransactionId } = request.params;
            const result = resolve3dsTransaction(pspTransactionId);

            if (!result.found) {
                return reply.status(404).send({
                    error: `3DS transaction not found: ${pspTransactionId}`,
                });
            }

            return reply.type('text/html').send(result.html);
        },
    });
}
