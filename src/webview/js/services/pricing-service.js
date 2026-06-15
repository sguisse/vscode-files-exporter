import { PricingGeminiService } from './pricing-gemini-service.js';
import { PricingGptService } from './pricing-gpt-service.js';
import { PricingClaudeService } from './pricing-claude-service.js';

export const PricingService = {
    estimateTokensNumber(files) {
        // Mock implementation: Since Webview cannot read raw file contents directly via fs,
        // we simulate a generic number of tokens based on the amount of generated files.
        // In a real implementation, you would trigger an IPC call to let the backend count chars.
        if (!files || files.length === 0) return 0;
        return files.length * 5454; // Arbitrary mock multiplier
    },

    tokensPriceEstimationByAiModels(files) {
        const estimatedInputTokens = this.estimateTokensNumber(files);
        const llms = [];

        if (estimatedInputTokens > 0) {
            llms.push(...PricingGeminiService.computePrice(estimatedInputTokens));
            llms.push(...PricingGptService.computePrice(estimatedInputTokens));
            llms.push(...PricingClaudeService.computePrice(estimatedInputTokens));
        }

        return {
            estimatedInputTokens,
            llms
        };
    }
};
