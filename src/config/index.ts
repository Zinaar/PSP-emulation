import 'dotenv/config';

/**
 * Application configuration derived from environment variables.
 * All configuration is centralized here to avoid scattered env access.
 */
export interface AppConfig {
    port: number;
    databaseUrl: string;
    pspBaseUrl: string;
    appBaseUrl: string;
    pspRetryAttempts: number;
    pspRetryDelayMs: number;
}

const config: AppConfig = Object.freeze({
    port: parseInt(process.env.PORT || '3000', 10),
    databaseUrl: process.env.DATABASE_URL || 'postgres://psp:psp@localhost:5432/psp',
    pspBaseUrl: process.env.PSP_BASE_URL || 'http://localhost:3000/psp',
    appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
    pspRetryAttempts: parseInt(process.env.PSP_RETRY_ATTEMPTS || '3', 10),
    pspRetryDelayMs: parseInt(process.env.PSP_RETRY_DELAY_MS || '500', 10),
});

export default config;
