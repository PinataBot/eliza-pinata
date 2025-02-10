import {
  type Action,
  elizaLogger,
  generateText,
  generateObject,
  ModelClass,
  State,
  composeContext,
  IAgentRuntime,
  Memory,
  HandlerCallback,
  Content,
  ServiceType,
} from "@elizaos/core";
import { z } from "zod";
import { SuiService } from "../services/sui.ts";
import { fetchTokenData } from "../utils/fetchTokensData.ts";
import { walletProvider } from "../providers/wallet.ts";

// Compose the prompt to analyze the token data with risk management and swap details
const portfolioAnalysisPrompt = (walletInfo: any): string => {
  return `
You are provided with a current portfolio and a list of available actions. Your tasks are as follows:

1. **Analyze the Portfolio:**
   - Examine all tokens in the portfolio (provided as \`${walletInfo}\`).
   - Evaluate each token based on its data and prevailing market conditions.

2. **Decision Making:**
   - Choose the best trading action for one token from the portfolio. Your decision must be one of:
     - **BUY**
     - **SELL**
     - **HOLD**
     - **REBALANCE**
   - **Risk Management:**
     - When considering a swap or buy action, assess the portfolio balance to determine the maximum available funds.
     - Apply risk management principles to decide the appropriate trading amount so as not to overexpose the portfolio to any single token.
   - **Important Considerations:**
     - If you decide to **SELL** a token:
       - Ensure you do not sell all SUI coins; always retain approximately 0.1 SUI for transaction fees.
       - Trigger the subsequent action \`swap\` and include detailed swap information:
         - **fromTokenType**: the token being sold.
         - **toTokenType**: the token to be bought.
         - **amount**: the quantity to swap, determined by risk management and the current portfolio balance.
         - **walletAddress**: the wallet address from which the swap will be executed.
     - If no clear trading opportunity exists (i.e., if the recommendation is HOLD or REBALANCE), trigger the next action \`analyze token market\`.

3. **Output Format:**
   - Return your response as a JSON object with the following structure:
     \`\`\`json
     {
       "tokenName": "<string>",
       "coinType": "<string>",
       "recommendation": "BUY" | "SELL" | "HOLD" | "REBALANCE",
       "confidence": <number between 0 and 100>,
       "reasoning": "<string>",
       "risks": ["<string>", "..."],
       "opportunities": ["<string>", "..."],
       "nextAction": {
         "action": "swap" | "analyze token market",
         "details": "<string or JSON object with swap details>"
       }
     }
     \`\`\`
   - **Only one token should be recommended** in the output.
   - The \`nextAction\` field should be set as follows:
     - If **SELL** is recommended (triggering a swap), set \`"action": "swap"\` and provide the swap details (including \`fromTokenType\`, \`toTokenType\`, \`amount\`, and \`walletAddress\`) in the \`details\` field.
     - Otherwise (if the recommendation is HOLD or REBALANCE), set \`"action": "analyze token market"\` and include any relevant details.

4. **Context:**
   - Current portfolio data: \`${walletInfo}\`
   - Available actions: \`{{actions}}\`

Based on your analysis of the portfolio and market conditions, provide the recommended trading action for one token along with the appropriate next call action in the JSON format as specified above.
`;
};

export default {
  name: "PORTFOLIO_ANALYSIS",
  similes: [
    "PORTFOLIO",
    "PORTFOLIO_ANALYSIS",
    "PORTFOLIO_ANALYZE",
    "PORTFOLIO_ASSESS",
  ],
  description: "Analyze your portfolio",
  examples: [],
  validate: async (
    runtime: IAgentRuntime,
    message: Memory
  ): Promise<boolean> => {
    elizaLogger.info(
      "Validating PORTFOLIO_ANALYSIS for agent:",
      message.agentId
    );
    return true;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    params: any,
    callback?: HandlerCallback
  ) => {
    try {
      elizaLogger.log("Starting PORTFOLIO_ANALYSIS handler...");
      const walletInfo = await walletProvider.get(runtime, message, state);
      state.walletInfo = walletInfo;

      console.log("Wallet Info", walletInfo);
      // Initialize or update state
      if (!state) {
        state = (await runtime.composeState(message)) as State;
      } else {
        state = await runtime.updateRecentMessageState(state);
      }

      // Compose transfer context
      const tokenInfoContext = composeContext({
        state,
        template: portfolioAnalysisPrompt(walletInfo),
      });
      // Execute prompt to extract cointype
      const content = await generateText({
        runtime,
        context: tokenInfoContext,
        modelClass: ModelClass.LARGE,
      });

      console.log("Portfolio Content", content);

      if (!content) {
        throw new Error("Failed to generate analysis.");
      }

      elizaLogger.debug("Raw analysis response:", content);

      if (callback) {
        await callback({
          text: content,
          type: "analysis",
        });
      }

      return true;
    } catch (error) {
      elizaLogger.error("PORTFOLIO_ANALYSIS handler error:", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  },
} as Action;
