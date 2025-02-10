// import {
//   ActionExample,
//   Content,
//   HandlerCallback,
//   IAgentRuntime,
//   Memory,
//   ModelClass,
//   State,
//   composeContext,
//   elizaLogger,
//   generateObject,
//   type Action,
// } from "@elizaos/core";
// import { z } from "zod";
//
// import { walletProvider } from "../providers/wallet.ts";
//
// export interface TokenInfoContent extends Content {
//   coinType: string;
// }
//
// function isTokenInfoContent(content: Content): content is TokenInfoContent {
//   console.log("Content for token info", content);
//   return typeof content.coinType === "string";
// }
//
// const tokenInfoTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.
//
// Example response:
// \`\`\`json
// {
//     "coinType": "0x2::sui::SUI"
// }
// \`\`\`
//
// Example response for multiple tokens:
// \`\`\`json
// {
//     "coinType": "0x2::sui::SUI,0x2::aaa::AAA"
// }
// \`\`\`
//
// {{recentMessages}}
//
// Given the recent messages, extract the following information about the requested token:
// - Coin type
//
// Respond with a JSON markdown block containing only the extracted values.`;
//
// const formatCoinDetails = (response: any[]): string => {
//   if (!response) {
//     return "Error: Data object is undefined or null.";
//   }
//   console.log(response);
//   const data = response[0];
//
//   const coinMetadata = data.coinMetadata || {};
//   const decimals = Number(coinMetadata.decimals || 0);
//
//   return ``;
// };
//
// export default {
//   name: "TOKEN_INFO",
//   similes: [
//     "TOKEN_INFO",
//     "TOKEN_INFO_SUI",
//     "TOKEN_INFO_DETAILS",
//     "TOKEN_INFO_SUI_DETAILS",
//   ],
//   validate: async (runtime: IAgentRuntime, message: Memory) => {
//     console.log("Validating token info from user:", message.userId);
//     //add custom validate logic here
//     /*
//             const adminIds = runtime.getSetting("ADMIN_USER_IDS")?.split(",") || [];
//             //console.log("Admin IDs from settings:", adminIds);
//
//             const isAdmin = adminIds.includes(message.userId);
//
//             if (isAdmin) {
//                 //console.log(`Authorized transfer from user: ${message.userId}`);
//                 return true;
//             }
//             else
//             {
//                 //console.log(`Unauthorized transfer attempt from user: ${message.userId}`);
//                 return false;
//             }
//             */
//     return true;
//   },
//   description: "Get information about a token or tokens",
//   handler: async (
//     runtime: IAgentRuntime,
//     message: Memory,
//     state: State,
//     _options: { [key: string]: unknown },
//     callback?: HandlerCallback
//   ): Promise<boolean> => {
//     elizaLogger.log("Starting SEND_TOKEN handler...");
//
//     const walletInfo = await walletProvider.get(runtime, message, state);
//     state.walletInfo = walletInfo;
//
//     // Initialize or update state
//     if (!state) {
//       state = (await runtime.composeState(message)) as State;
//     } else {
//       state = await runtime.updateRecentMessageState(state);
//     }
//
//     // Define the schema for the expected output
//     const tokenSchema = z.object({
//       coinType: z.string(),
//     });
//
//     // Compose transfer context
//     const tokenInfoContext = composeContext({
//       state,
//       template: tokenInfoTemplate,
//     });
//
//     // Generate transfer content with the schema
//     const content = await generateObject({
//       runtime,
//       context: tokenInfoContext,
//       schema: tokenSchema,
//       modelClass: ModelClass.SMALL,
//     });
//
//     const tokenInfoContent = content.object as TokenInfoContent;
//
//     // Validate transfer content
//     if (!isTokenInfoContent(tokenInfoContent)) {
//       console.error("Invalid content for TOKEN_INFO action.");
//       if (callback) {
//         callback({
//           text: "Unable to process token info request. Invalid content provided.",
//           content: { error: "Invalid token info content" },
//         });
//       }
//       return false;
//     }
//
//
//
//     try {
//       const tokenInfo = await fetchTokenData(tokenInfoContent.coinType);
//       if (!tokenInfo) {
//         console.error("Failed to fetch token info.");
//         if (callback) {
//           callback({
//             text: "Failed to fetch token info.",
//             content: { error: "Failed to fetch token info" },
//           });
//         }
//         return false;
//       }
//       const formattedResponse = formatCoinDetails(tokenInfo);
//     //   runtime.knowledgeManager.createMemory(})
//       if (callback) {
//         callback({
//           text: formattedResponse,
//           content: {
//             success: true,
//             tokenInfo: formattedResponse,
//           },
//         });
//       }
//
//       return true;
//     } catch (error) {
//       console.error("Error during token info:", error);
//       if (callback) {
//         callback({
//           text: `Error fetching token info: ${error.message}`,
//           content: { error: error.message },
//         });
//       }
//       return false;
//     }
//   },
//
//   examples: [
//     [
//       {
//         user: "{{user1}}",
//         content: {
//           text: "What is the token info for 0x4f2e63be8e7fe287836e29cde6f3d5cbc96eefd0c0e3f3747668faa2ae7324b0",
//         },
//       },
//       {
//         user: "{{user2}}",
//         content: {
//           text: "I'll fetch the token info now...",
//           action: "TOKEN_INFO",
//         },
//       },
//       {
//         user: "{{user2}}",
//         content: {
//           text: "Successfully fetched token info for 0x4f2e63be8e7fe287836e29cde6f3d5cbc96eefd0c0e3f3747668faa2ae7324b0",
//         },
//       },
//     ],
//     [
//       {
//         user: "{{user1}}",
//         content: {
//           text: "What is the tokens info for 0xd976fda9a9786cda1a36dee360013d775a5e5f206f8e20f84fad3385e99eeb2d::aaa::AAA,0xf22da9a24ad027cccb5f2d496cbe91de953d363513db08a3a734d361c7c17503::LOFI::LOFI",
//         },
//       },
//       {
//         user: "{{user2}}",
//         content: {
//           text: "I'll fetch the tokens info now...",
//           action: "TOKEN_INFO",
//         },
//       },
//       {
//         user: "{{user2}}",
//         content: {
//           text: "Successfully fetched tokens info for 0xd976fda9a9786cda1a36dee360013d775a5e5f206f8e20f84fad3385e99eeb2d::aaa::AAA,0xf22da9a24ad027cccb5f2d496cbe91de953d363513db08a3a734d361c7c17503::LOFI::LOFI",
//         },
//       },
//     ],
//   ] as ActionExample[][],
// } as Action;
