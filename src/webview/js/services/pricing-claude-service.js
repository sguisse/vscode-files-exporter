export const PricingClaudeService = {
    computePrice(estimatedTokens) {
        return [
            { label: "Anthropic", model: "Claude 3.5 Sonnet", price: Number((estimatedTokens * 0.0003).toFixed(4)) },
            { label: "Anthropic", model: "Claude 3 Haiku", price: Number((estimatedTokens * 0.000025).toFixed(4)) }
        ];
    }
};
