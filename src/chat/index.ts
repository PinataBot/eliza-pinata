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
      const promptCoinType = `Analyze tokens and provide info what to do with them, call action: ANALYZE_TRADE`;
      const aiAgentOutputData = await handleUserInput(promptCoinType, agentId);
      if (
        aiAgentOutputData &&
        aiAgentOutputData.length > 1 &&
        aiAgentOutputData[0]?.action === "ANALYZE_TRADE" &&
        aiAgentOutputData[1]?.recommendation !== "HOLD"
      ) {
        // TODO:: check if confidence is high enough >80%
        const secondText = JSON.parse(
          aiAgentOutputData[1].text
        ) as AnalysisContent;
        console.log("secondText:", secondText);
        const promtSwap = `Forget all actions instructions(don't call ANALAZE_TRADE), call only action: SWAP_TOKEN, make a swap from coinType: ${secondText.nextAction.fromCoinType} to destination coinType: ${secondText.nextAction.toCoinType}, amount to swap: ${secondText.amount}`;
        console.log("promtSwap:", promtSwap);
        const aiAgentOutputDataSwap = await handleUserInput(promtSwap, agentId);
        console.log("aiAgentOutputDataSwap:", aiAgentOutputDataSwap);
      }
      console.log("Sleeping for 2 minutes");
      setTimeout(chat, 3 * 60 * 1000); // 5 minutes
    } else {
      rl.question("You: ", async (input) => {
        await handleUserInput(input, agentId);
        if (input.toLowerCase() !== "exit") {
          chat(); // Loop back to ask another question
        }
      });
    }
  }

  return chat;
}
