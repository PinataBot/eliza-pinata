import {Plugin} from "@elizaos/core";
import transferToken from "./actions/transfer.ts";
import {WalletProvider, walletProvider} from "./providers/wallet.ts";
import {SuiService} from "./services/sui.ts";
import swapToken from "./actions/swap.ts";
import {coinsProvider} from "./providers/coins.ts";

export {WalletProvider};

export const suiPlugin: Plugin = {
    name: "sui",
    description: "Sui Plugin for Eliza",
    actions: [transferToken, swapToken],
    evaluators: [],
    providers: [walletProvider, coinsProvider],
    services: [new SuiService()],
};

export default suiPlugin;
