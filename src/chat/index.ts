import { settings } from "@elizaos/core";
import readline from "readline";
import { AnalysisContent } from "../packages/plugin-sui/actions/tokenAnalysis.ts";

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

export async function startChat(characters, isAutomated = false) {
  async function chat() {
    const agentId = characters[0].name ?? "Agent";
    if (isAutomated) {
      automatedChat(agentId);
    } else {
      manualChat(agentId);
    }
  }

  /**
   * Runs the chat in automated mode by calling the AI agent repeatedly.
   */
  async function automatedChat(agentId: string) {
    // 1. First AI call: Analyze tokens
    const promptCoinType = `Analyze tokens and provide info what to do with them`;
    const aiAgentOutputData = await handleUserInput(promptCoinType, agentId);

    if (!aiAgentOutputData || aiAgentOutputData.length <= 1) {
      console.log("No data from agent");
      return;
    }

    const resultData = JSON.parse(aiAgentOutputData[1].text) as AnalysisContent;
    const firstAction = aiAgentOutputData[0]?.action;

    // 2. Handle different actions from the AI agent
    if (
      firstAction === "ANALYZE_TRADE" &&
      resultData.recommendation !== "HOLD"
    ) {
      await handleAnalyzeTrade(resultData, agentId);
    } else if (
      firstAction === "PORTFOLIO_ANALYSIS" &&
      resultData.recommendation !== "HOLD"
    ) {
      await handlePortfolioAnalysis(resultData, agentId);
    }

    // 3. Schedule next automated run
    const minutes = 2;
    console.log(`Sleeping for ${minutes} minutes`);
    setTimeout(chat, minutes * 60 * 1000);
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
   * Handles logic when the AI agent's first action is "ANALYZE_TRADE".
   */
  async function handleAnalyzeTrade(
    resultData: AnalysisContent,
    agentId: string
  ) {
    if (resultData.confidence > 80) {
      // 2a. Check portfolio if confidence is high
      const promptPortfolio = `Check portfolio, provide info what to do with new coin data: ${JSON.stringify(
        resultData
      )}, call action: ANALYZE_PORTFOLIO`;

      const aiAgentOutputDataPortfolio = await handleUserInput(
        promptPortfolio,
        agentId
      );
      console.log("aiAgentOutputDataPortfolio:", aiAgentOutputDataPortfolio);

      if (!aiAgentOutputDataPortfolio || aiAgentOutputDataPortfolio.length <= 1)
        return;

      const resultPortfolio = JSON.parse(
        aiAgentOutputDataPortfolio[1].text
      ) as AnalysisContent;
      const portfolioAction = aiAgentOutputDataPortfolio[0]?.action;

      // 2b. If we get a "PORTFOLIO_ANALYSIS" action and it's not "HOLD", then swap
      if (
        portfolioAction === "PORTFOLIO_ANALYSIS" &&
        resultPortfolio.recommendation !== "HOLD"
      ) {
        const promptSwap = `make a swap of your portfolio from coinType: ${resultPortfolio.nextAction?.fromCoinType} to destination coinType: ${resultPortfolio.nextAction?.toCoinType}, amount to swap: ${resultPortfolio.amount}`;
        const aiAgentOutputDataSwap = await handleUserInput(
          promptSwap,
          agentId
        );
        console.log(
          "aiAgentOutputDataSwap after tokens analysis:",
          aiAgentOutputDataSwap
        );
      }
    }
  }

  /**
   * Handles logic when the AI agent's action is "PORTFOLIO_ANALYSIS".
   */
  async function handlePortfolioAnalysis(
    resultData: AnalysisContent,
    agentId: string
  ) {
    if (resultData.confidence > 80) {
      // Swap if confidence is high and recommendation isn’t "HOLD"
      const promptSwap = `make a swap of your portfolio from coinType: ${resultData.nextAction?.fromCoinType} to destination coinType: ${resultData.nextAction?.toCoinType}, amount to swap: ${resultData.amount}`;
      const aiAgentOutputDataSwap = await handleUserInput(promptSwap, agentId);
      console.log(
        "aiAgentOutputDataSwap after portfolio analysis:",
        aiAgentOutputDataSwap
      );
    }
  }

  return chat;
}
