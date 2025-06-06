import * as fs from 'fs';
import * as path from 'path';
import { ExecutionResult, ArbOpportunity } from '../types';
import { logger } from './logger';
import { getConfig } from '../config';

// Define the database structure
interface ArbDatabase {
    opportunities: {
        timestamp: string;
        opportunity: ArbOpportunity;
        executed: boolean;
        polymarketOrderId?: string;
        proboOrderId?: string;
        success?: boolean;
    }[];
    stats: {
        totalOpportunitiesFound: number;
        totalExecuted: number;
        totalSuccessful: number;
        totalFailed: number;
        avgProfitPercent: number;
        highestProfitPercent: number;
        totalProfit: number;
        lastUpdated: string;
    };
}

// Default database structure
const defaultDb: ArbDatabase = {
    opportunities: [],
    stats: {
        totalOpportunitiesFound: 0,
        totalExecuted: 0,
        totalSuccessful: 0,
        totalFailed: 0,
        avgProfitPercent: 0,
        highestProfitPercent: 0,
        totalProfit: 0,
        lastUpdated: new Date().toISOString()
    }
};

// Database file path
const DB_PATH = process.env.DB_PATH || './data/arb-history.json';

/**
 * Ensure the database directory exists
 */
function ensureDbDirectory() {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created database directory: ${dir}`);
    }
}

/**
 * Initialize the database
 * @returns The database object
 */
export function initDatabase(): ArbDatabase {
    try {
        ensureDbDirectory();
        
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            const db = JSON.parse(data) as ArbDatabase;
            logger.info('Database loaded successfully', { 
                opportunities: db.opportunities.length,
                lastUpdated: db.stats.lastUpdated
            });
            return db;
        } else {
            fs.writeFileSync(DB_PATH, JSON.stringify(defaultDb, null, 2), 'utf8');
            logger.info('New database created');
            return defaultDb;
        }
    } catch (error) {
        logger.error('Failed to initialize database', error);
        return defaultDb;
    }
}

/**
 * Save the database to disk
 * @param db The database object
 */
export function saveDatabase(db: ArbDatabase): void {
    try {
        ensureDbDirectory();
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
        logger.debug('Database saved successfully');
    } catch (error) {
        logger.error('Failed to save database', error);
    }
}

/**
 * Log an arbitrage opportunity to the database
 * @param opportunity The arbitrage opportunity
 * @param executed Whether the opportunity was executed
 */
export function logOpportunity(opportunity: ArbOpportunity, executed = false): void {
    try {
        const db = initDatabase();
        
        db.opportunities.push({
            timestamp: new Date().toISOString(),
            opportunity,
            executed
        });
        
        // Update stats
        db.stats.totalOpportunitiesFound++;
        db.stats.avgProfitPercent = 
            (db.stats.avgProfitPercent * (db.stats.totalOpportunitiesFound - 1) + opportunity.profitPercent) / 
            db.stats.totalOpportunitiesFound;
        
        if (opportunity.profitPercent > db.stats.highestProfitPercent) {
            db.stats.highestProfitPercent = opportunity.profitPercent;
        }
        
        db.stats.lastUpdated = new Date().toISOString();
        
        saveDatabase(db);
    } catch (error) {
        logger.error('Failed to log opportunity', error);
    }
}

/**
 * Log an executed arbitrage result to the database
 * @param result The execution result
 */
export function logExecution(result: ExecutionResult): void {
    try {
        const db = initDatabase();
        const lastIndex = db.opportunities.length - 1;
        
        if (lastIndex >= 0) {
            // Update the last opportunity with execution details
            db.opportunities[lastIndex].executed = true;
            db.opportunities[lastIndex].polymarketOrderId = result.polymarketOrder.orderId;
            db.opportunities[lastIndex].proboOrderId = result.proboOrder.orderId;
            db.opportunities[lastIndex].success = 
                result.polymarketOrder.success && result.proboOrder.success;
        }
        
        // Update stats
        db.stats.totalExecuted++;
        
        if (result.polymarketOrder.success && result.proboOrder.success) {
            db.stats.totalSuccessful++;
            db.stats.totalProfit += result.opportunity.profitPercent;
        } else {
            db.stats.totalFailed++;
        }
        
        db.stats.lastUpdated = new Date().toISOString();
        
        saveDatabase(db);
    } catch (error) {
        logger.error('Failed to log execution', error);
    }
}

/**
 * Get arbitrage statistics
 * @returns The statistics object
 */
export function getStats(): ArbDatabase['stats'] {
    try {
        const db = initDatabase();
        return db.stats;
    } catch (error) {
        logger.error('Failed to get statistics', error);
        return defaultDb.stats;
    }
}

/**
 * Get recent arbitrage opportunities
 * @param limit The maximum number of opportunities to return
 * @returns The recent opportunities
 */
export function getRecentOpportunities(limit = 10): ArbDatabase['opportunities'] {
    try {
        const db = initDatabase();
        return db.opportunities.slice(-limit);
    } catch (error) {
        logger.error('Failed to get recent opportunities', error);
        return [];
    }
}
