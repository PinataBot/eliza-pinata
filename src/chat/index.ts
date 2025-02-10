import { settings } from "@elizaos/core";
import readline from "readline";
import { loadWhitelistTokens } from "../packages/plugin-sui/utils/loadWhitelistTokens.ts";

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
      const promptCoinType = `Analyze tokens and provide info what to do with them`;
      const aiAgentOutputData = await handleUserInput(promptCoinType, agentId);
      console.log("ai agent output data:", aiAgentOutputData);
      const tokenDataSummaryString = JSON.stringify(aiAgentOutputData);
      // TODO:: need to check if wallet balance have enough money to swap
      // if not start analysis of portfolio
      // if yes swap token
      // if yes, then if wallet balance don't have this token, then buy it
      // if yes, then if wallet balance have this token, then sell it

      console.log("\n\n\ntokenDataSummary:", tokenDataSummaryString);
      console.log("Sleeping for 2 minutes");
      setTimeout(chat, 1 * 60 * 1000); // 5 minutes
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
