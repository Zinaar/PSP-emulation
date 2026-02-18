import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

/**
 * Fastify plugin that registers Swagger/OpenAPI documentation.
 * API docs are available at /docs.
 */
async function swaggerPlugin(fastify: FastifyInstance) {
    await fastify.register(fastifySwagger, {
        openapi: {
            openapi: '3.0.0',
            info: {
                title: 'Payment Integration API',
                description: [
                    'Fastify-based API with PSP Simulator for payment processing, webhooks, and 3DS simulation.',
                    '',
                    '## Card Number Prefixes',
                    '| Prefix | Outcome |',
                    '|--------|---------|',
                    '| `5555` | Direct Success → webhook fires immediately |',
                    '| `4000` | Direct Failure → webhook fires immediately |',
                    '| `4111` | 3DS Required → redirect URL returned, client must visit it |',
                    '',
                    '## 3DS Flow',
                    '1. Create transaction with a `4111` card → response includes `threeDsRedirectUrl`',
                    '2. Client opens the redirect URL in browser → 3DS verification page shown',
                    '3. After 1.5s delay, PSP sends a `SUCCESS` webhook back',
                    '',
                    '**⏱ 3DS Expiry:** If the client does not visit the 3DS link within **5 minutes**, the PSP automatically sends a `FAILED` webhook and the transaction expires.',
                    '',
                    '## State Machine',
                    '`CREATED` → `PENDING_3DS` / `SUCCESS` / `FAILED`',
                    '`PENDING_3DS` → `SUCCESS` / `FAILED`',
                    '`SUCCESS` and `FAILED` are terminal states.',
                ].join('\n'),
                version: '1.0.0',
            },
            tags: [
                { name: 'Transactions', description: 'Transaction management endpoints' },
                { name: 'Webhooks', description: 'Webhook handling endpoints' },
                { name: 'PSP Simulator', description: 'Mock Payment Service Provider endpoints' },
            ],
        },
    });

    await fastify.register(fastifySwaggerUi, {
        routePrefix: '/docs',
    });
}

export default fp(swaggerPlugin, {
    name: 'swagger',
});
