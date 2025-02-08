import { settings } from "@elizaos/core";
import readline from "readline";
import { loadWhitelistTokens } from "../packages/utils/loadWhitelistTokens.ts";
import { fetchTokenData } from "../packages/utils/fetchTokensData.ts";

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
    data.forEach((message) => console.log(`${"Agent"}: ${message.text}`));
  } catch (error) {
    console.error("Error fetching response:", error);
  }
}

export async function startChat(characters, isAutomated = false) {
  async function chat() {
    const agentId = characters[0].name ?? "Agent";
    if (isAutomated) {
      const input = "Hello";
      const tokenDataSummary = [];
      const whilelistTokens = await loadWhitelistTokens();
      for (const token of whilelistTokens) {
        await handleUserInput(input, agentId);
      }

      setTimeout(chat, 5 * 60 * 1000); // 5 minutes
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
