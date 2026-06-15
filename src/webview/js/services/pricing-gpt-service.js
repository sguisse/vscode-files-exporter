export const PricingGptService = {
    computePrice(estimatedTokens) {
        return [
            { label: "OpenAI", model: "GPT-4o", price: Number((estimatedTokens * 0.0005).toFixed(4)) },
            { label: "OpenAI", model: "GPT-3.5-Turbo", price: Number((estimatedTokens * 0.00005).toFixed(4)) }
        ];
    }
};
