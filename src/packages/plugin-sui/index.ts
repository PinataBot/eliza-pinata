import { Plugin } from "@elizaos/core";

import { WalletProvider, walletProvider } from "./providers/wallet.ts";
import { SuiService } from "./services/sui.ts";
import { coinsProvider } from "./providers/coins.ts";

import swapToken from "./actions/swap.ts";
import trendingTokensAction from "./actions/trendingTokens.ts";
import portfolioAnalysisAction from "./actions/portfolioAnalysis.ts";
// import transferToken from "./actions/transfer.ts";
//import summarizeRecommendationsAction from "./actions/summarizeRecommendations.ts";
//import analyzeMultipleTokensAction from "./actions/analyzeMultipleTokens.ts";
export { WalletProvider };

export const suiPlugin: Plugin = {
  name: "sui",
  description: "Sui Plugin for Eliza",
  actions: [
    swapToken,
    trendingTokensAction,
    portfolioAnalysisAction,
    //summarizeRecommendationsAction,
    //analyzeMultipleTokensAction,
    // transferToken,
  ],
  evaluators: [],
  providers: [walletProvider, coinsProvider],
  services: [new SuiService()],
};

export default suiPlugin;
