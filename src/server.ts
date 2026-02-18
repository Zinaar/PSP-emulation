import { buildApp } from './app';
import config from './config';
import { prettyLoggerConfig, printStartupBanner } from './config/logger';

/**
 * Application entry point.
 * Builds the Fastify app and starts listening on the configured port.
 */
async function startServer(): Promise<void> {
    try {
        const app = await buildApp({ logger: prettyLoggerConfig as any });

        await app.listen({ port: config.port, host: '0.0.0.0' });
        printStartupBanner(config.port);
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

