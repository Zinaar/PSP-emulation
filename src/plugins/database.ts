import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import pg from 'pg';

/**
 * Fastify plugin that creates a PostgreSQL connection pool
 * and decorates the Fastify instance with `pg` for database access.
 */
async function databasePlugin(fastify: FastifyInstance, options: { databaseUrl: string }) {
    const pool = new pg.Pool({
        connectionString: options.databaseUrl,
    });

    // Verify connection on startup
    try {
        const client = await pool.connect();
        client.release();
        fastify.log.info('Database connection established');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        fastify.log.error(`Failed to connect to database: ${errorMessage}`);
        throw error;
    }

    fastify.decorate('pg', pool);

    fastify.addHook('onClose', async () => {
        await pool.end();
        fastify.log.info('Database connection pool closed');
    });
}

export default fp(databasePlugin, {
    name: 'database',
});
