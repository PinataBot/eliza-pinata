import {
  type Action,
  elizaLogger,
  generateText,
  ModelClass,
  parseJSONObjectFromText,
  State,
  composeContext,
} from "@elizaos/core";

export default {
  name: "SUMMARIZE_RECOMMENDATIONS",
  similes: ["SUMMARIZE", "ANALYZE_RECOMMENDATIONS", "BEST_TRADE"],
  description:
    "Analyze multiple token recommendations and select the best trading opportunity",
  validate: async (runtime, message) => {
    elizaLogger.info(
      "Validating SUMMARIZE_RECOMMENDATIONS for user:",
      message.userId
    );
    return true;
  },
  handler: async (runtime, message, state, params, callback) => {
    try {
      elizaLogger.log("Starting SUMMARIZE_RECOMMENDATIONS handler...");

      // Initialize or update state
      if (!state) {
        state = (await runtime.composeState(message)) as State;
      } else {
        state = await runtime.updateRecentMessageState(state);
      }

      const tokenRecommendations = params.recommendations;
      elizaLogger.info(
        "Processing token recommendations:",
        tokenRecommendations
      );

      if (!tokenRecommendations || !Array.isArray(tokenRecommendations)) {
        throw new Error("Invalid or missing token recommendations");
      }

      // Compose the analysis prompt
      const analysisPrompt = `Analyze these token recommendations data and identify the best trading opportunity.
Return a JSON object with:
{
  "tokenName": string,
  "coinType": string, 
  "recommendation": "BUY" | "SELL" | "HOLD",
  "confidence": number (0-100),
  "reasoning": string,
  "risks": string[],
  "opportunities": string[],
  "opinion": string (explain why this token was selected over others)
}

Token Recommendations:
${JSON.stringify(tokenRecommendations, null, 2)}`;

      const context = composeContext({
        state,
        template: analysisPrompt,
      });

      // Generate analysis from the prompt
      const analysisResult = await generateText({
        runtime,
        context,
        modelClass: ModelClass.LARGE,
      });

      if (!analysisResult) {
        throw new Error("Failed to generate analysis");
      }

      elizaLogger.debug("Raw analysis response:", analysisResult);

      // Parse the JSON response
      const resultObj = parseJSONObjectFromText(analysisResult);
      elizaLogger.info("Selected best trade recommendation:", resultObj);

      if (callback) {
        await callback({
          text: JSON.stringify(resultObj),
          type: "trade_analysis",
        });
      }

      return true;
    } catch (error) {
      elizaLogger.error("Error in SUMMARIZE_RECOMMENDATIONS handler:", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  },
  examples: [],
} as Action;
