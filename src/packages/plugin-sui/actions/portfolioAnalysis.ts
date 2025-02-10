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
  UUID,
} from "@elizaos/core";
import { z } from "zod";
import { SuiService } from "../services/sui.ts";
import { fetchTokenData } from "../utils/fetchTokensData.ts";
import { walletProvider } from "../providers/wallet.ts";
import { AnalysisContent } from "./tokenAnalysis.ts";
import { isAnalysisContent } from "./tokenAnalysis.ts";
import { putBlobAndSave } from "../utils/walrus.ts";
import { v4 as uuid } from "uuid";

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
     - Don't invest nearly the entire available SUI balance, reserving approximately 0.1 SUI for transaction fees and do not invest more than 10%-20% of the available SUI balance.
     - One asset can't be more than 50% of the portfolio.
     - If don't know what to do, recommend HOLD.
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
       "amount": <number>,  // For BUY: the SUI amount to be spent, always check BUY context to ensure the recommendation is feasible; for SELL: the token amount to sell; for HOLD: 0.
       "reasoning": "<string>",
       "risks": ["<string>", "..."],
       "opportunities": ["<string>", "..."],
       "nextAction": {
         "fromCoinType": "<string>",
         "toCoinType": "<string>",
       }
     }
     \`\`\`
   - **Only one token should be recommended** in the output.

4. **Context:**
   - Current portfolio data: \`${walletInfo}\`
   - Get coin data from previous message: \`{{recentMessages}}\`  
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
    message: Memory,
  ): Promise<boolean> => {
    elizaLogger.info(
      "Validating PORTFOLIO_ANALYSIS for agent:",
      message.agentId,
    );
    return true;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    params: any,
    callback?: HandlerCallback,
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

      const analysisSchema = z.object({
        tokenName: z.string(),
        coinType: z.string(),
        recommendation: z.enum(["BUY", "SELL", "HOLD", "REBALANCE"]),
        amount: z.number(),
        confidence: z.number(),
        reasoning: z.string(),
        risks: z.array(z.string()),
        opportunities: z.array(z.string()),
        nextAction: z.object({
          fromCoinType: z.string(),
          toCoinType: z.string(),
        }),
      });

      // Execute prompt to extract cointype
      const content = await generateObject({
        runtime,
        context: tokenInfoContext,
        modelClass: ModelClass.LARGE,
        schema: analysisSchema,
      });

      const analysisContent = content.object as AnalysisContent;
      // Validate transfer content
      if (!isAnalysisContent(analysisContent)) {
        console.error("Invalid content for ANALYZE_TRADE action.");
        if (callback) {
          callback({
            text: "Unable to process transfer request. Invalid content provided.",
            content: { error: "Invalid transfer content" },
          });
        }
        return false;
      }
      putBlobAndSave(
        runtime,
        message,
        JSON.stringify(analysisContent),
        "response",
      ).then(() => {
        console.log("Blob saved");
      });
      if (callback) {
        await callback({
          text: JSON.stringify(analysisContent),
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
