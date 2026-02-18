/**
 * NestJS-style colorized logger configuration for Fastify.
 * Produces clean, human-readable logs with colors, timestamps, and icons.
 */
export const prettyLoggerConfig = {
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
            messageFormat: '{msg}',
            customPrettifiers: {},
        },
    },
    level: 'info',
};

/**
 * Chalk-style ANSI color codes for manual log formatting.
 */
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',

    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',

    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgRed: '\x1b[41m',
    bgCyan: '\x1b[46m',
};

/**
 * Prints a NestJS-style startup banner to the console.
 */
export function printStartupBanner(port: number): void {
    const divider = `${colors.dim}${'─'.repeat(50)}${colors.reset}`;

    console.log('');
    console.log(divider);
    console.log(`  ${colors.bold}${colors.green}✓${colors.reset} ${colors.bold}Application started successfully${colors.reset}`);
    console.log(divider);
    console.log(`  ${colors.cyan}➜${colors.reset}  ${colors.dim}Server:${colors.reset}    ${colors.bold}http://localhost:${port}${colors.reset}`);
    console.log(`  ${colors.cyan}➜${colors.reset}  ${colors.dim}API Docs:${colors.reset}  ${colors.bold}http://localhost:${port}/docs${colors.reset}`);
    console.log(`  ${colors.cyan}➜${colors.reset}  ${colors.dim}PSP Sim:${colors.reset}   ${colors.bold}http://localhost:${port}/psp${colors.reset}`);
    console.log(divider);
    console.log('');
}
