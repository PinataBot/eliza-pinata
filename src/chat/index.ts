import { settings } from "@elizaos/core";
import readline from "readline";
import { AnalysisContent } from "../packages/plugin-sui/actions/trendingTokens.ts";
import {
  CONFIDENCE_THRESHOLD,
  IS_AUTOMATED,
  REPEAT_PROMT_EVERY_MIN,
} from "../config.ts";
import {
  MessageActionType,
  MessageRecommendationAfterAnalysis,
} from "../packages/plugin-sui/types/MessageActionType.ts";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.on("SIGINT", () => {
  rl.close();
  process.exit(0);
});

async function handleUserInput(input, agentId) {
  if (input.toLowerCase() === "exit") {
    rl.close();
    process.exit(0);
  }

  try {
    const serverPort = parseInt(settings.SERVER_PORT || "3000");
    const response = await fetch(
      `http://localhost:${serverPort}/${agentId}/message`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: input,
          userId: "user",
          userName: "User",
        }),
      }
    );

    const data = await response.json();
    console.log("\n\n\nagent output:", data);
    data.forEach((message) => console.log(`${"Agent"}: ${message.text}`));
    return data;
  } catch (error) {
    console.error("Error fetching response:", error);
  }
}

export async function startChat(characters) {
  async function chat() {
    const agentId = characters[0].name ?? "Agent";
    if (IS_AUTOMATED) {
      automatedChat(agentId);
    } else {
      manualChat(agentId);
    }
  }

  /**
   * Runs the chat in automated mode by calling the AI agent repeatedly.
   */
  async function automatedChat(agentId: string) {
    try {
      // 1. First AI call: analysis trending tokens
      const promptTrendingTokens = `What's the best trending token to trade?`;
      const aiAgentOutputData = await handleUserInput(
        promptTrendingTokens,
        agentId
      );

      if (!aiAgentOutputData || aiAgentOutputData.length <= 1) {
        console.log("No data from agent");
        return;
      }

      let resultData: AnalysisContent;
      try {
        resultData = JSON.parse(aiAgentOutputData[1].text) as AnalysisContent;
      } catch (error) {
        console.error("Error parsing agent output:", error);
        return;
      }

      const firstAction = aiAgentOutputData[0]?.action;
      // 2. Handle different actions from the AI agent
      if (
        firstAction === MessageActionType.TRENDING_TOKENS &&
        resultData.recommendation !== MessageRecommendationAfterAnalysis.HOLD
      ) {
        console.log("Handling portfolio analysis");
        await analyzePortfolioHandler(resultData, agentId);
      } else if (
        firstAction === MessageActionType.PORTFOLIO_ANALYSIS &&
        resultData.recommendation !== MessageRecommendationAfterAnalysis.HOLD
      ) {
        // make swap here
        console.log("Handling portfolio analysis");
        await handleSwap(resultData, agentId);
      }
    } catch (error) {
      console.error("Error in automated chat:", error);
    } finally {
      // 3. Schedule next automated run
      console.log(`Sleeping for ${REPEAT_PROMT_EVERY_MIN} minutes`);
      setTimeout(chat, REPEAT_PROMT_EVERY_MIN * 60 * 1000);
    }
  }

  /**
   * Runs the chat in manual (interactive) mode.
   */
  function manualChat(agentId: string) {
    rl.question("You: ", async (input) => {
      // Send user input to AI agent
      await handleUserInput(input, agentId);

      // Continue unless user types "exit"
      if (input.toLowerCase() !== "exit") {
        manualChat(agentId);
      }
    });
  }

  /**
   * Handles logic when the AI agent's first action is "TRENDING_TOKENS".
   */
  async function analyzePortfolioHandler(
    resultData: AnalysisContent,
    agentId: string
  ) {
    if (resultData.confidence >= CONFIDENCE_THRESHOLD) {
      // 2a. Check portfolio if confidence is high
      const promptPortfolio = `Analyze portfolio, provide info what to do with new coin data: ${JSON.stringify(
        resultData
      )}`;

      const aiAgentOutputDataPortfolio = await handleUserInput(
        promptPortfolio,
        agentId
      );

      if (!aiAgentOutputDataPortfolio || aiAgentOutputDataPortfolio.length <= 1)
        return;

      let resultPortfolio: AnalysisContent;
      try {
        resultPortfolio = JSON.parse(
          aiAgentOutputDataPortfolio[1].text
        ) as AnalysisContent;
      } catch (error) {
        console.error("Error parsing agent output:", error);
        return;
      }
      const portfolioAction = aiAgentOutputDataPortfolio[0]?.action;

      // 2b. If we get a "PORTFOLIO_ANALYSIS" action and it's not "HOLD", then swap
      if (
        portfolioAction === MessageActionType.PORTFOLIO_ANALYSIS &&
        resultPortfolio.recommendation !==
          MessageRecommendationAfterAnalysis.HOLD
      ) {
        await handleSwap(resultPortfolio, agentId);
      }
    }
  }

  /**
   * Handles logic when the AI agent's after portfolio analysis action is "PORTFOLIO_ANALYSIS".
   */
  async function handleSwap(resultData: AnalysisContent, agentId: string) {
    if (resultData.confidence >= CONFIDENCE_THRESHOLD) {
      // Swap if confidence is high and recommendation isn’t "HOLD"
      const promptSwap = `make a swap ${resultData.amount} ${resultData.nextAction?.fromCoinType} to ${resultData.nextAction?.toCoinType}`;
      const aiAgentOutputDataSwap = await handleUserInput(promptSwap, agentId);
      console.log(
        "aiAgentOutputDataSwap after portfolio analysis:",
        aiAgentOutputDataSwap
      );
    }
  }

  return chat;
}
