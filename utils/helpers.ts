// Utility functions for the arbitrage bot
import { Depth, ArbOpportunity } from '../types';
import { getConfig } from '../config';
import { logger } from './logger';

/**
 * Find the lowest ask price from a market depth
 * @param depth The market depth data
 * @returns The lowest ask price
 */
export function findLowestAskPrice(depth: Depth): number | null {
    try {
        const sellPrices = Object.keys(depth.sell)
            .filter(p => Number(depth.sell[p]) > 0)
            .map(Number)
            .sort((a, b) => a - b);
        
        return sellPrices.length > 0 ? sellPrices[0] : null;
    } catch (error) {
        logger.error('Error finding lowest ask price', error);
        return null;
    }
}

/**
 * Find the highest bid price from a market depth
 * @param depth The market depth data
 * @returns The highest bid price
 */
export function findHighestBidPrice(depth: Depth): number | null {
    try {
        const buyPrices = Object.keys(depth.buy)
            .filter(p => Number(depth.buy[p]) > 0)
            .map(Number)
            .sort((a, b) => b - a);
        
        return buyPrices.length > 0 ? buyPrices[0] : null;
    } catch (error) {
        logger.error('Error finding highest bid price', error);
        return null;
    }
}

/**
 * Calculate arbitrage opportunity between Polymarket and Probo
 * @param polyDepth Polymarket depth data
 * @param proboDepth Probo depth data
 * @returns Arbitrage opportunity details
 */
export function calculateArbOpportunity(polyDepth: Depth, proboDepth: Depth): ArbOpportunity {
    try {
        const config = getConfig();
        const polyPrice = findLowestAskPrice(polyDepth);
        const proboPrice = findLowestAskPrice(proboDepth);
        
        if (polyPrice === null || proboPrice === null) {
            return {
                found: false,
                isViable: false,
                profitPercent: 0,
                polymarketPrice: 0,
                proboPrice: 0,
                polymarketQty: 0,
                proboQty: 0,
                reason: 'Missing price data from one or both exchanges'
            };
        }
        
        logger.debug('Prices found', { polyPrice, proboPrice });
        
        // Convert prices to comparable units
        const combinedPrice = polyPrice * 10 + proboPrice;
        const potentialProfit = 10 - combinedPrice;
        const profitPercent = potentialProfit * 10;
        
        // Check if arbitrage is possible
        if (combinedPrice >= 10) {
            return {
                found: false,
                isViable: false,
                profitPercent: 0,
                polymarketPrice: polyPrice,
                proboPrice: proboPrice,
                polymarketQty: 0,
                proboQty: 0,
                reason: 'Combined price exceeds 10, no arbitrage possible'
            };
        }
        
        // Determine if profit meets minimum threshold
        const isViable = profitPercent >= config.expectedArbPercentMin;
        
        // Calculate optimal quantities
        const polyQty = Number(polyDepth.sell[polyPrice.toString()]);
        const proboQty = Number(proboDepth.sell[proboPrice.toString()]);
        
        let finalPolyQty = 0;
        let finalProboQty = 0;
        
        if (polyQty * config.dollarPriceInr / 10 <= proboQty) {
            finalPolyQty = polyQty;
            finalProboQty = polyQty * (config.dollarPriceInr / 10);
        } else {
            finalProboQty = proboQty;
            finalPolyQty = proboQty / (config.dollarPriceInr / 10);
        }
        
        return {
            found: true,
            isViable,
            profitPercent,
            polymarketPrice: polyPrice,
            proboPrice: proboPrice,
            polymarketQty: finalPolyQty,
            proboQty: finalProboQty,
            reason: isViable ? undefined : 'Profit below minimum threshold'
        };
    } catch (error) {
        logger.error('Error calculating arbitrage opportunity', error);
        return {
            found: false,
            isViable: false,
            profitPercent: 0,
            polymarketPrice: 0,
            proboPrice: 0,
            polymarketQty: 0,
            proboQty: 0,
            reason: `Error: ${error.message}`
        };
    }
}

/**
 * Sleep for a specified number of milliseconds
 * @param ms Milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
