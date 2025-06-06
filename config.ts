// Configuration settings for the arbitrage bot
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config();

export interface Config {
    // Market IDs
    proboTokenId: number;
    polymarketTokenId: string;
    
    // API credentials
    proboAuthToken: string;
    polymarketApiKey: string;
    polymarketApiSecret: string;
    polymarketPassPhrase: string;
    ethPrivateKey: string;
    
    // API endpoints
    clobApiUrl: string;
    rpcUrl: string;
    
    // Arbitrage settings
    dollarPriceInr: number;
    expectedArbPercentMin: number;
    
    // Operational settings
    dryRun: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    
    // Data storage
    dbPath: string;
    
    // Retry settings
    maxRetries: number;
    retryDelayMs: number;
    
    // Rate limiting
    requestThrottleMs: number;
}

// Default configuration
const defaultConfig: Config = {
    proboTokenId: 4031200,
    polymarketTokenId: "35192935476060157102953995417579331568794667667550449899073688437267716869794",
    
    proboAuthToken: process.env.PROBO_AUTH_TOKEN || "OjhfQB2HA8pbmsBTkdLti9/XAtBslZIGrirt4vW8w6Q=",
    polymarketApiKey: process.env.POLYMARKET_API_KEY || "",
    polymarketApiSecret: process.env.POLYMARKET_API_SECRET || "",
    polymarketPassPhrase: process.env.POLYMARKET_PASS_PHRASE || "",
    ethPrivateKey: process.env.PRIVATE_KEY || "",
    
    clobApiUrl: process.env.CLOB_API_URL || "https://clob.polymarket.com",
    rpcUrl: process.env.RPC_URL || "https://polygon-rpc.com",
    
    dollarPriceInr: Number(process.env.DOLLAR_PRICE_INR) || 85,
    expectedArbPercentMin: Number(process.env.EXPECTED_ARB_PERCENT_MIN) || 5,
    
    dryRun: process.env.DRY_RUN === "true" || false,
    logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    
    dbPath: process.env.DB_PATH || './data/arb-history.json',
    
    maxRetries: Number(process.env.MAX_RETRIES) || 3,
    retryDelayMs: Number(process.env.RETRY_DELAY_MS) || 1000,
    
    requestThrottleMs: Number(process.env.REQUEST_THROTTLE_MS) || 500
};

/**
 * Get configuration with optional overrides
 * @param overrides Optional configuration overrides
 * @returns The configuration object
 */
export const getConfig = (overrides: Partial<Config> = {}): Config => {
    // Apply any overrides to the default config
    return { ...defaultConfig, ...overrides };
};

/**
 * Create a config file if it doesn't exist
 */
export function ensureConfigFile(): void {
    const envSamplePath = path.join(process.cwd(), '.env.sample');
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath) && fs.existsSync(envSamplePath)) {
        fs.copyFileSync(envSamplePath, envPath);
        console.log('Created .env file from .env.sample');
    }
}
