import {
  ActionExample,
  Content,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  ModelClass,
  ServiceType,
  // ServiceType,
  State,
  composeContext,
  elizaLogger,
  generateObject,
  type Action,
} from "@elizaos/core";
import { SuiService } from "../services/sui.ts";
import { z } from "zod";
import { walletProvider } from "../providers/wallet.ts";

export interface SwapPayload extends Content {
  from_coin_type: string;
  destination_coin_type: string;
  amount: string | number;
}

function isSwapContent(content: Content): content is SwapPayload {
  console.log("Content for swap", content);
  return (
    typeof content.from_coin_type === "string" &&
    typeof content.destination_coin_type === "string" &&
    (typeof content.amount === "string" || typeof content.amount === "number")
  );
}

const swapTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "from_coin_type": "sui",
    "destination_coin_type": "usdc",
    "amount": "1"
}
\`\`\`

\`\`\`json
{
    "from_coin_type": "0x2::sui::SUI",
    "destination_coin_type": "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
    "amount": "0.1"
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the following information about the requested token swap:
- Source Coin Type you want to swap from
- Destination Coin Type you want to swap to
- Source Coin Amount to swap


Respond with a JSON markdown block containing only the extracted values.`;

export default {
  name: "SWAP_TOKEN",
  similes: [
    "SWAP_TOKENS",
    "SWAP_SUI",
    "SWAP",
    "MAKE_SWAP",
    "SWAP_FROM_ONE_COIN_TYPE_TO_ANOTHER",
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    console.log("Validating sui swap from user:", message.userId);
    return true;
  },
  description:
    "Swap from any coin type in the agent's wallet to another coin type",
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<boolean> => {
    elizaLogger.log("Starting SWAP_TOKEN handler...");

    // const walletInfo = await walletProvider.get(runtime, message, state);
    // state.walletInfo = walletInfo;

    const service = runtime.getService<SuiService>(ServiceType.TRANSCRIPTION);

    // Initialize or update state
    if (!state) {
      state = (await runtime.composeState(message)) as State;
    } else {
      state = await runtime.updateRecentMessageState(state);
    }

    // Define the schema for the expected output
    const swapSchema = z.object({
      from_coin_type: z.string(),
      destination_coin_type: z.string(),
      amount: z.union([z.string(), z.number()]),
    });

    // Compose transfer context
    const swapContext = composeContext({
      state,
      template: swapTemplate,
    });

    // Generate transfer content with the schema
    const content = await generateObject({
      runtime,
      context: swapContext,
      schema: swapSchema,
      modelClass: ModelClass.SMALL,
    });

    console.log("Generated content:", content);
    const swapContent = content.object as SwapPayload;
    elizaLogger.info("Swap content:", swapContent);

    if (service.getNetwork() == "mainnet") {
      // Validate transfer content
      if (!isSwapContent(swapContent)) {
        console.error("Invalid content for SWAP_TOKEN action.");
        if (callback) {
          callback({
            text: "Unable to process swap request. Invalid content provided.",
            content: { error: "Invalid transfer content" },
          });
        }
        return false;
      }

      const destinationToken = await service.getTokenMetadata(
        swapContent.destination_coin_type
      );

      elizaLogger.log("Destination token:", destinationToken);

      const fromToken = await service.getTokenMetadata(
        swapContent.from_coin_type
      );

      elizaLogger.log("From token:", fromToken);

      // one action only can call one callback to save new message.
      // runtime.processActions
      if (destinationToken && fromToken) {
        try {
          const swapAmount = service.getAmount(swapContent.amount, fromToken);

          elizaLogger.info("Swap amount:", swapAmount.toString());
          elizaLogger.info(
            "Destination token address:",
            destinationToken.coinType
          );
          elizaLogger.info("From token address:", fromToken.coinType);

          const result = await service.swapToken(
            fromToken.coinType,
            destinationToken.coinType,
            swapAmount.toString(),
            0
          );

          if (result.success) {
            callback({
              text: `Successfully swapped ${swapContent.amount} ${swapContent.from_coin_type} to ${swapContent.destination_coin_type}, Transaction: ${service.getTransactionLink(
                result.tx
              )}`,
              content: swapContent,
            });
          }
        } catch (error) {
          elizaLogger.error("Error swapping token:", error);
          callback({
            text: `Failed to swap ${error}, swapContent : ${JSON.stringify(
              swapContent
            )}`,
            content: { error: "Failed to swap token" },
          });
        }
      } else {
        callback({
          text: `destination token: ${swapContent.destination_coin_type} or from token: ${swapContent.from_coin_type} not found`,
          content: { error: "Destination token not found" },
        });
      }
    } else {
      callback({
        text:
          "Sorry, I can only swap on the mainnet, parsed params : " +
          JSON.stringify(swapContent, null, 2),
        content: { error: "Unsupported network" },
      });
      return false;
    }

    return true;
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Swap 1 SUI to USDC",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I'll help you swap 1 SUI to USDC now...",
          action: "SWAP_TOKEN",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Successfully swapped 1 SUI to USDC, Transaction: 0x39a8c432d9bdad993a33cc1faf2e9b58fb7dd940c0425f1d6db3997e4b4b05c0",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Swap 1 0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI to 0x8993129d72e733985f7f1a00396cbd055bad6f817fee36576ce483c8bbb8b87b::sudeng::SUDENG",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I'll help you swap 1 Sui to Sudeng now...",
          action: "SWAP_TOKEN",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Successfully swapped 1 Sui to Sudeng, Transaction: 0x39a8c432d9bdad993a33cc1faf2e9b58fb7dd940c0425f1d6db3997e4b4b05c0",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Swap 1 USDC to SUI",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I'll help you swap 1 SUI to USDC now...",
          action: "SWAP_TOKEN",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Successfully swapped 1 SUI to USDC, Transaction: 0x39a8c432d9bdad993a33cc1faf2e9b58fb7dd940c0425f1d6db3997e4b4b05c0",
        },
      },
    ],
  ] as ActionExample[][],
} as Action;
