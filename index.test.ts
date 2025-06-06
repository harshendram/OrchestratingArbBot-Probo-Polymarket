/**
 * @jest-environment node
 */
import { findAndExecArb, startArbBot } from "./index";
import { calculateArbOpportunity } from "./utils/helpers";
import type { Depth, ArbOpportunity } from "./types";
// In Jest, these globals are automatically available without imports

// Mock the imports
jest.mock("./probo", () => ({
    createOrder: jest.fn().mockResolvedValue({ success: true, orderId: "probo-order-1" }),
    getDepth: jest.fn().mockResolvedValue({
        buy: { "1.8": "500" },
        sell: { "2.0": "1000" }
    })
}));

jest.mock("./polymarket", () => ({
    createOrder: jest.fn().mockResolvedValue({ success: true, orderId: "poly-order-1" }),
    getDepth: jest.fn().mockResolvedValue({
        buy: { "0.6": "200" },
        sell: { "0.8": "300" }
    }),
    approveAllowance: jest.fn().mockResolvedValue(true)
}));

jest.mock("./config", () => ({
    getConfig: jest.fn().mockReturnValue({
        proboTokenId: 12345,
        polymarketTokenId: "6789",
        dollarPriceInr: 85,
        expectedArbPercentMin: 5,
        dryRun: true
    })
}));

jest.mock("./utils/helpers", () => {
    const originalModule = jest.requireActual("./utils/helpers");
    return {
        ...originalModule,
        sleep: jest.fn().mockResolvedValue(undefined)
    };
});

describe("Arbitrage Logic Tests", () => {
    // Sample test data
    const polyDepth: Depth = {
        buy: { "0.6": "200" },
        sell: { "0.8": "300" }
    };

    const proboDepth: Depth = {
        buy: { "1.8": "500" },
        sell: { "2.0": "1000" }
    };

    // Test for viable arbitrage opportunity
    test("findAndExecArb should identify and execute viable arbitrage", async () => {
        // Set up the mock implementation for this specific test
        const calculateArbOpportunitySpy = jest.spyOn(require("./utils/helpers"), 'calculateArbOpportunity')
            .mockReturnValue({
                found: true,
                isViable: true,
                profitPercent: 7.5,
                polymarketPrice: 0.8,
                proboPrice: 2.0,
                polymarketQty: 300,
                proboQty: 2550
            });
        
        const result = await findAndExecArb(polyDepth, proboDepth);
        
        expect(result).not.toBeNull();
        expect(result?.opportunity.found).toBe(true);
        expect(result?.opportunity.isViable).toBe(true);
        expect(result?.polymarketOrder.success).toBe(true);
        expect(result?.proboOrder.success).toBe(true);

        // Clean up mock
        calculateArbOpportunitySpy.mockRestore();
    });

    // Test for non-viable arbitrage opportunity
    test("findAndExecArb should identify but not execute non-viable arbitrage", async () => {
        const calculateArbOpportunitySpy = jest.spyOn(require("./utils/helpers"), 'calculateArbOpportunity')
            .mockReturnValue({
                found: true,
                isViable: false,
                profitPercent: 2.5,
                polymarketPrice: 0.8,
                proboPrice: 2.0,
                polymarketQty: 300,
                proboQty: 2550,
                reason: "Profit below minimum threshold"
            });

        const result = await findAndExecArb(polyDepth, proboDepth);
        
        expect(result).toBeNull();
        
        // Clean up mock
        calculateArbOpportunitySpy.mockRestore();
    });

    // Test for no arbitrage opportunity
    test("findAndExecArb should identify no arbitrage opportunity", async () => {
        const calculateArbOpportunitySpy = jest.spyOn(require("./utils/helpers"), 'calculateArbOpportunity')
            .mockReturnValue({
                found: false,
                isViable: false,
                profitPercent: 0,
                polymarketPrice: 0.9,
                proboPrice: 2.0,
                polymarketQty: 0,
                proboQty: 0,
                reason: "Combined price exceeds 10, no arbitrage possible"
            });

        const result = await findAndExecArb(polyDepth, proboDepth);
        
        expect(result).toBeNull();
        
        // Clean up mock
        calculateArbOpportunitySpy.mockRestore();
    });
});

// Direct test cases
describe("Direct Arbitrage Tests", () => {
    test("Viable arbitrage opportunity with specific depths", async () => {
        // This is a viable arbitrage (poly: 0.74, probo: 2.0)
        // Combined: 0.74*10 + 2.0 = 9.4 < 10, profit: 0.6 (6%)
        const viableResult = await findAndExecArb({
            buy: { "0.7": "100" },
            sell: { "0.74": "100" }
        }, {
            buy: { "1.8": "100" },
            sell: { "2.0": "100000" }
        });
        
        expect(viableResult).not.toBeNull();
    });
    
    test("Non-viable arbitrage opportunity with specific depths", async () => {
        // This is a non-viable arbitrage (poly: 0.85, probo: 2.0)
        // Combined: 0.85*10 + 2.0 = 10.5 > 10, no arb possible
        const nonViableResult = await findAndExecArb({
            buy: { "0.8": "100" },
            sell: { "0.85": "100" }
        }, {
            buy: { "1.9": "100" },
            sell: { "2.0": "100000" }
        });
        
        expect(nonViableResult).toBeNull();
    });
});

// Helper function tests
describe("Helper Function Tests", () => {
    test("calculateArbOpportunity should calculate correct arbitrage values", () => {
        const polyDepth: Depth = {
            buy: { "0.7": "100" },
            sell: { "0.8": "300" }
        };

        const proboDepth: Depth = {
            buy: { "1.8": "500" },
            sell: { "2.0": "1000" }
        };

        const result = calculateArbOpportunity(polyDepth, proboDepth);
        
        expect(result.found).toBe(true);
        expect(result.polymarketPrice).toBe(0.8);
        expect(result.proboPrice).toBe(2.0);
        // 10 - (0.8*10 + 2.0) = 10 - 10 = 0% profit
        expect(result.profitPercent).toBeCloseTo(0);
        expect(result.isViable).toBe(false);
    });
});
