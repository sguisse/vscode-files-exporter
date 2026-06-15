import { PricingGeminiService } from './pricing-gemini-service.js';
import { PricingGptService } from './pricing-gpt-service.js';
import { PricingClaudeService } from './pricing-claude-service.js';

export const PricingService = {
    tokensPriceEstimationByAiModels(estimatedInputTokens) {
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
