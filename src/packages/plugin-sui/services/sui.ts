import {
  elizaLogger,
  IAgentRuntime,
  Service,
  ServiceType,
} from "@elizaos/core";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { parseAccount, SuiNetwork } from "../utils.ts";
import { AggregatorClient, Env } from "@cetusprotocol/aggregator-sdk";
import BN from "bn.js";
import { getTokenMetadata, TokenMetadata } from "../tokens.ts";
import { Signer } from "@mysten/sui/cryptography";
import {
  Transaction,
  TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { AGENT_OBJECT_ID, PACKAGE_API, PACKAGE_ID } from "../utils/contract.ts";
import { FilteredCoinMetadata } from "../types/tokenMarketDataTypes.ts";
import { SUI_TYPE_ARG } from "@mysten/sui/utils";
import { BlobItemType } from "../../adapter-supabase/types.ts";

const aggregatorURL = "https://api-sui.cetus.zone/router_v2/find_routes";

interface SwapResult {
  success: boolean;
  tx: string;
  message: string;
}

export class SuiService extends Service {
  static serviceType: ServiceType = ServiceType.TRANSCRIPTION;
  private suiClient: SuiClient;
  private network: SuiNetwork;
  private wallet: Signer;

  initialize(runtime: IAgentRuntime): Promise<void> {
    this.suiClient = new SuiClient({
      url: getFullnodeUrl(runtime.getSetting("SUI_NETWORK") as SuiNetwork),
    });
    this.network = runtime.getSetting("SUI_NETWORK") as SuiNetwork;
    this.wallet = parseAccount(runtime);
    return null;
  }

  async getTokenMetadata(coinType: string): Promise<FilteredCoinMetadata> {
    const meta = await getTokenMetadata(coinType);
    return meta;
  }

  getAddress() {
    return this.wallet.toSuiAddress();
  }

  getAmount(amount: string | number, meta: FilteredCoinMetadata) {
    return BigInt(Number(amount) * Math.pow(10, meta.decimals));
  }

  getNetwork() {
    return this.network;
  }

  getTransactionLink(tx: string) {
    if (this.network === "mainnet") {
      return `https://suivision.xyz/txblock/${tx}`;
    } else if (this.network === "testnet") {
      return `https://testnet.suivision.xyz/txblock/${tx}`;
    } else if (this.network === "devnet") {
      return `https://devnet.suivision.xyz/txblock/${tx}`;
    } else if (this.network === "localnet") {
      return `localhost : ${tx}`;
    }
  }

  async swapToken(
    fromCoinType: string,
    toCoinType: string,
    amount: number | string,
    out_min_amount: number
  ): Promise<SwapResult> {
    const fromMeta = await getTokenMetadata(fromCoinType);
    const toMeta = await getTokenMetadata(toCoinType);
    const client = new AggregatorClient(
      aggregatorURL,
      this.wallet.toSuiAddress(),
      this.suiClient,
      Env.Mainnet
    );

    const amountBN = new BN(amount.toString());

    // provider list : https://api-sui.cetus.zone/router_v2/status
    const routerRes = await client.findRouters({
      from: fromMeta.coinType,
      target: toMeta.coinType,
      amount: amountBN,
      byAmountIn: true, // `true` means fix input amount, `false` means fix output amount
      depth: 3, // max allow 3, means 3 hops
      providers: [
        "KRIYAV3",
        "CETUS",
        "SCALLOP",
        "KRIYA",
        "BLUEFIN",
        "DEEPBOOKV3",
        "FLOWXV3",
        "BLUEMOVE",
        "AFTERMATH",
        "FLOWX",
        "TURBOS",
        // "AFSUI",
        // "VOLO",
        // "SPRINGSUI",
        // "ALPHAFI",
        // "HAEDAL",
        // "HAEDALPMM",
      ],
    });

    if (routerRes === null) {
      elizaLogger.error(
        "No router found" +
          JSON.stringify({
            from: fromMeta.coinType,
            target: toMeta.coinType,
            amount: amount,
          })
      );
      return {
        success: false,
        tx: "",
        message: "No router found",
      };
    }

    if (routerRes.amountOut.toNumber() < out_min_amount) {
      return {
        success: false,
        tx: "",
        message: "Out amount is less than out_min_amount",
      };
    }

    let coin: TransactionObjectArgument;
    const routerTx = new Transaction();

    console.log("Amount -------", amount);
    console.log(fromCoinType.toUpperCase() === SUI_TYPE_ARG.toUpperCase());
    if (fromCoinType.toUpperCase() === SUI_TYPE_ARG.toUpperCase()) {
      coin = routerTx.splitCoins(routerTx.gas, [amount]);
    } else {
      const allCoins = await this.suiClient.getCoins({
        owner: this.wallet.toSuiAddress(),
        coinType: fromMeta.coinType,
        limit: 30,
      });

      console.log("All coins:", allCoins);

      if (allCoins.data.length === 0) {
        elizaLogger.error("No coins found");
        return {
          success: false,
          tx: "",
          message: "No coins found",
        };
      }

      const mergeCoins = [];

      for (let i = 1; i < allCoins.data.length; i++) {
        elizaLogger.info("Coin:", allCoins.data[i]);
        mergeCoins.push(allCoins.data[i].coinObjectId);
      }
      elizaLogger.info("Merge coins:", mergeCoins);

      routerTx.mergeCoins(allCoins.data[0].coinObjectId, mergeCoins);
      coin = routerTx.splitCoins(allCoins.data[0].coinObjectId, [amount]);
    }

    const targetCoin = await client.routerSwap({
      routers: routerRes.routes,
      byAmountIn: true,
      txb: routerTx,
      inputCoin: coin,
      slippage: 0.5,
    });

    // checking threshold

    // routerTx.moveCall({
    //     package:
    //         "0x57d4f00af225c487fd21eed6ee0d11510d04347ee209d2ab48d766e48973b1a4",
    //     module: "utils",
    //     function: "check_coin_threshold",
    //     arguments: [
    //         targetCoin,
    //         routerTx.pure(bcs.U64.serialize(out_min_amount)),
    //     ],
    //     typeArguments: [otherType],
    // });
    routerTx.setGasBudget(100_000_000); // 0.1 SUI
    routerTx.transferObjects([targetCoin], this.wallet.toSuiAddress());
    routerTx.setSender(this.wallet.toSuiAddress());
    const result = await client.signAndExecuteTransaction(
      routerTx,
      this.wallet
    );

    if (result.effects.status.status === "failure") {
      return {
        success: false,
        tx: "",
        message: "Swap failed: " + result.effects.status.error,
      };
    }

    await this.suiClient.waitForTransaction({
      digest: result.digest,
    });

    return {
      success: true,
      tx: result.digest,
      message: "Swap successful",
    };
  }

  /**
   * Add blob. Update NFT table with blobId
   * @param blobId
   * @param blobType
   */
  async addBlobToNft(blobId: string, blobType: BlobItemType): Promise<string> {
    console.log("Sui move call addBlob");
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${blobType == "response" ? PACKAGE_API.ADD_RESPONSE_BLOB : PACKAGE_API.ADD_ACTION_BLOB}`,
      arguments: [tx.object(AGENT_OBJECT_ID), tx.pure.string(blobId)],
    });

    tx.setSender(this.wallet.toSuiAddress());

    const result = await this.suiClient.signAndExecuteTransaction({
      transaction: tx,
      signer: this.wallet,
    });

    await this.suiClient.waitForTransaction({
      digest: result.digest,
    });

    console.log(`Blob ${blobType} added to NFT:`, result.digest);
    return result.digest;
  }
}
