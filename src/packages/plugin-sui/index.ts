import { Plugin } from "@elizaos/core";

import { WalletProvider, walletProvider } from "./providers/wallet.ts";
import { SuiService } from "./services/sui.ts";
import { coinsProvider } from "./providers/coins.ts";

import swapToken from "./actions/swap.ts";
import transferToken from "./actions/transfer.ts";
import tokenAnalysisAction from "./actions/tokenAnalysis.ts";
import portfolioAnalysisAction from "./actions/portfolioAnalysis.ts";
import summarizeRecommendationsAction from "./actions/summarizeRecommendations.ts";

export { WalletProvider };

export const suiPlugin: Plugin = {
  name: "sui",
  description: "Sui Plugin for Eliza",
  actions: [
    transferToken,
    swapToken,
    tokenAnalysisAction,
    summarizeRecommendationsAction,
    portfolioAnalysisAction,
  ],
  evaluators: [],
  providers: [walletProvider, coinsProvider],
  services: [new SuiService()],
};

export default suiPlugin;
