#!/usr/bin/env bun
// CLI tool for the arbitrage bot
import { Command } from "commander";
import { startArbBot } from "./index";
import { getConfig } from "./config";
import { logger } from "./utils/logger";

const program = new Command();

program
    .name("arb-bot")
    .description("Arbitrage bot between Probo and Polymarket")
    .version("1.0.0");

program
    .command("start")
    .description("Start the arbitrage bot")
    .option("-i, --interval <interval>", "Polling interval in milliseconds", "5000")
    .option("-d, --dry-run", "Run in dry-run mode (no real orders)")
    .option("-l, --log-level <level>", "Log level (debug, info, warn, error)", "info")
    .action(async (options: { dryRun?: boolean; logLevel?: string; interval: string }) => {
        try {
            // Override config with CLI options
            const config = getConfig();
            if (options.dryRun) {
                process.env.DRY_RUN = "true";
            }
            if (options.logLevel) {
                process.env.LOG_LEVEL = options.logLevel;
            }
            
            const intervalMs = parseInt(options.interval, 10);
            
            logger.info("Starting arbitrage bot with CLI options", {
                intervalMs,
                dryRun: options.dryRun || config.dryRun,
                logLevel: options.logLevel || config.logLevel
            });
            
            await startArbBot(intervalMs);
        } catch (error) {
            logger.error("Error starting arbitrage bot", error);
            process.exit(1);
        }
    });

program
    .command("check")
    .description("Check for arbitrage opportunities without executing trades")
    .action(async () => {
        try {
            // Force dry-run mode
            process.env.DRY_RUN = "true";
            
            logger.info("Checking for arbitrage opportunities (dry-run)");
            
            // Run a single cycle
            const { createOrder: _createOrderProbo, getDepth: getDepthProbo } = await import("./probo");
            const { createOrder: _createOrderPoly, getDepth: getDepthPoly } = await import("./polymarket");
            const { findAndExecArb } = await import("./index");
            
            const config = getConfig();
            
            // Fetch market depths
            const [depthProbo, depthPoly] = await Promise.all([
                getDepthProbo(config.proboTokenId),
                getDepthPoly(config.polymarketTokenId)
            ]);
            
            // Find arbitrage opportunities
            await findAndExecArb(depthPoly, depthProbo);
            
            process.exit(0);
        } catch (error) {
            logger.error("Error checking arbitrage opportunities", error);
            process.exit(1);
        }
    });

// Declare process if it's not recognized by TypeScript
declare const process: {
    argv: string[];
    env: Record<string, string | undefined>;
    exit(code: number): void;
};

// Parse CLI arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
