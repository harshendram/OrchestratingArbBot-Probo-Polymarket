import { createOrder as createOrderProbo, getDepth as getDepthProbo } from "./probo";
import { createOrder as createOrderPoly, getDepth as getDepthPoly, approveAllowance } from "./polymarket";
import { Depth, ArbOpportunity, ExecutionResult, OrderResult } from "./types";
import { calculateArbOpportunity, sleep } from "./utils/helpers";
import { logger } from "./utils/logger";
import { getConfig, ensureConfigFile } from "./config";
import { logOpportunity, logExecution } from "./utils/database";

// Declare process if it's not recognized by TypeScript
declare const process: {
    env: Record<string, string | undefined>;
    exit(code: number): void;
};

/**
 * Find and execute arbitrage opportunities between Polymarket and Probo
 * @param depthPoly Polymarket depth data
 * @param depthProbo Probo depth data
 * @returns Execution result or null if no opportunity found
 */
export async function findAndExecArb(depthPoly: Depth, depthProbo: Depth): Promise<ExecutionResult | null> {
    const config = getConfig();
    
    try {
        // Calculate arbitrage opportunity
        const opportunity = calculateArbOpportunity(depthPoly, depthProbo);
        
        // Log the opportunity to the database
        logOpportunity(opportunity, false);
        
        if (!opportunity.found) {
            logger.info("No arbitrage opportunity found", { reason: opportunity.reason });
            return null;
        }
        
        if (!opportunity.isViable) {
            logger.info("Arbitrage opportunity found, but profit is below threshold", { 
                profitPercent: opportunity.profitPercent,
                minRequired: config.expectedArbPercentMin 
            });
            return null;
        }
        
        logger.info("Viable arbitrage opportunity found", {
            polymarketPrice: opportunity.polymarketPrice,
            proboPrice: opportunity.proboPrice,
            polymarketQty: opportunity.polymarketQty,
            proboQty: opportunity.proboQty,
            profitPercent: opportunity.profitPercent
        });        // Execute arbitrage trades with retry logic
        let polyOrderResult: OrderResult = {
            success: false,
            error: new Error("Order not attempted"),
            exchangeResponse: null
        };
        let retries = 0;
        
        while (retries <= config.maxRetries) {
            try {                polyOrderResult = await createOrderPoly(
                    config.polymarketTokenId,
                    opportunity.polymarketPrice,
                    opportunity.polymarketQty,
                    'buy' as any // Use string literal with type assertion
                );
                
                if (polyOrderResult.success) break;
                
                logger.warn(`Polymarket order failed, retrying (${retries + 1}/${config.maxRetries})`);
                retries++;
                await sleep(config.retryDelayMs);
            } catch (error) {
                logger.error(`Error placing Polymarket order (attempt ${retries + 1})`, error);
                retries++;
                if (retries > config.maxRetries) {
                    return null;
                }
                await sleep(config.retryDelayMs);
            }
        }
        
        // Wait a short time between orders to avoid rate limiting
        await sleep(config.requestThrottleMs);
          // Place order on Probo with retry logic
        let proboOrderResult: OrderResult = {
            success: false,
            error: new Error("Order not attempted"),
            exchangeResponse: null
        };
        retries = 0;
        
        while (retries <= config.maxRetries) {
            try {                proboOrderResult = await createOrderProbo(
                    config.proboTokenId,
                    'buy' as any, // Use string literal with type assertion
                    opportunity.proboQty,
                    opportunity.proboPrice
                );
                
                if (proboOrderResult.success) break;
                
                logger.warn(`Probo order failed, retrying (${retries + 1}/${config.maxRetries})`);
                retries++;
                await sleep(config.retryDelayMs);
            } catch (error) {
                logger.error(`Error placing Probo order (attempt ${retries + 1})`, error);
                retries++;
                if (retries > config.maxRetries) {
                    return null;
                }
                await sleep(config.retryDelayMs);
            }
        }
        
        const executionResult: ExecutionResult = {
            polymarketOrder: polyOrderResult,
            proboOrder: proboOrderResult,
            opportunity,
            timestamp: new Date().toISOString()
        };
        
        // Log the execution to the database
        logExecution(executionResult);
        
        logger.info("Arbitrage execution completed", {
            polymarketOrderSuccess: polyOrderResult.success,
            proboOrderSuccess: proboOrderResult.success,
            polymarketOrderId: polyOrderResult.orderId,
            proboOrderId: proboOrderResult.orderId
        });
        
        return executionResult;
    } catch (error) {
        logger.error("Error during arbitrage execution", error);
        return null;
    }
}

/**
 * Main function to continuously monitor and execute arbitrage opportunities
 * @param intervalMs Polling interval in milliseconds
 * @returns Promise that never resolves (runs continuously)
 */
export async function startArbBot(intervalMs = 5000): Promise<void> {
    // Make sure the config file exists
    ensureConfigFile();
    const config = getConfig();
    
    logger.info("Starting arbitrage bot", {
        proboTokenId: config.proboTokenId,
        polymarketTokenId: config.polymarketTokenId,
        dollarPriceInr: config.dollarPriceInr,
        expectedArbPercentMin: config.expectedArbPercentMin,
        dryRun: config.dryRun
    });
    
    try {
        // Approve allowance for Polymarket with retry logic
        let allowanceApproved = false;
        let retries = 0;
        
        while (!allowanceApproved && retries <= config.maxRetries) {
            try {
                logger.info("Approving Polymarket allowance...");
                await approveAllowance(config.polymarketTokenId);
                allowanceApproved = true;
                logger.info("Polymarket allowance approved successfully");
            } catch (error) {
                logger.error(`Error approving Polymarket allowance (attempt ${retries + 1})`, error);
                retries++;
                if (retries > config.maxRetries) {
                    throw new Error("Failed to approve Polymarket allowance after maximum retries");
                }
                await sleep(config.retryDelayMs);
            }
        }
        
        logger.info("Bot initialized successfully, starting arbitrage monitoring...");
        
        let cycleCount = 0;
        const statusIntervalCycles = 60; // Log status every 60 cycles
        
        while (true) {
            try {
                cycleCount++;
                
                // Log status periodically
                if (cycleCount % statusIntervalCycles === 0) {
                    logger.info(`Bot running: completed ${cycleCount} cycles`);
                }
                
                // Fetch market depths with timeouts and error handling
                logger.debug("Fetching market depths...");
                let depthProbo: Depth | null = null;
                let depthPoly: Depth | null = null;
                
                try {
                    depthProbo = await Promise.race([
                        getDepthProbo(config.proboTokenId),
                        new Promise<null>((_, reject) => 
                            setTimeout(() => reject(new Error("Probo API timeout")), 15000)
                        )
                    ]) as Depth;
                } catch (error) {
                    logger.warn("Failed to fetch Probo depth data", error);
                }
                
                await sleep(config.requestThrottleMs); // Throttle between API calls
                
                try {
                    depthPoly = await Promise.race([
                        getDepthPoly(config.polymarketTokenId),
                        new Promise<null>((_, reject) => 
                            setTimeout(() => reject(new Error("Polymarket API timeout")), 15000)
                        )
                    ]) as Depth;
                } catch (error) {
                    logger.warn("Failed to fetch Polymarket depth data", error);
                }
                
                // Only proceed if both depths are available
                if (depthProbo && depthPoly) {
                    // Find and execute arbitrage if available
                    logger.debug("Analyzing arbitrage opportunities...");
                    await findAndExecArb(depthPoly, depthProbo);
                } else {
                    logger.warn("Skipped arbitrage cycle due to missing depth data");
                }
            } catch (error) {
                logger.error("Error in arbitrage cycle", error);
            }
            
            // Wait for next cycle with jitter to avoid thundering herd
            const jitter = Math.floor(Math.random() * 1000); // Add up to 1 second of random jitter
            await sleep(intervalMs + jitter);
        }
    } catch (error) {
        logger.error("Fatal error in arbitrage bot", error);
        throw error;
    }
}

// Export a function to run the bot
export function runBot(): void {
    const config = getConfig();
    
    // Check for dry run mode
    if (config.dryRun) {
        logger.info("Running in DRY RUN mode - no actual orders will be placed");
    }
      // Start the bot with error handling
    startArbBot().catch(error => {
        logger.error("Arbitrage bot crashed", error);
        // Exit with error code if available
        if (typeof process !== 'undefined') {
            process.exit(1);
        }
    });
}

// Run the bot if this file is executed directly
// In Node.js, we use __filename instead of import.meta.url
if (require.main === module) {
    runBot();
}

