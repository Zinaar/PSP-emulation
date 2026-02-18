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
}

const config: AppConfig = Object.freeze({
    port: parseInt(process.env.PORT || '3000', 10),
    databaseUrl: process.env.DATABASE_URL || 'postgres://psp:psp@localhost:5432/psp',
    pspBaseUrl: process.env.PSP_BASE_URL || 'http://localhost:3000/psp',
    appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
});

export default config;
