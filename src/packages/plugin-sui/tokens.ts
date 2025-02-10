import { SUI_DECIMALS, SUI_TYPE_ARG } from "@mysten/sui/utils";
import { fetchTokenData } from "./utils/fetchTokensData.ts";
import { FilteredCoinMetadata } from "./types/tokenMarketDataTypes.ts";
import { loadWhitelistTokens } from "./utils/loadWhitelistTokens.ts";

export interface TokenMetadata {
  symbol: string;
  decimals: number;
  tokenAddress: string;
}

export const getSuiMetadata = (): FilteredCoinMetadata => {
  return {
    _id: "670cfe741ce51ed9bf4433c6",
    decimals: 9,
    name: "Sui",
    symbol: "SUI",
    description: "",
    supply: 100000, // TODO::fix we need supply change it to BigInt
    createdAt: 1681392093366,
    lastTradeAt: 1718083324265,
    id: "0x9258181f5ceac8dbffb7030890243caed69a9599d2886d957a9cb7656af3bdb3",
    coinType: "0x2::sui::SUI",
    dev: "0x0000000000000000000000000000000000000000000000000000000000000000",
  };
};

// TODO::refactor this to universal function
export const getTokenMetadata = async (
  coinType: string,
): Promise<FilteredCoinMetadata> => {
  if (
    coinType === "0x2::sui::SUI" ||
    coinType === SUI_TYPE_ARG ||
    coinType ===
      "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI"
  ) {
    return getSuiMetadata();
  }

  const data = await fetchTokenData(getCoinTypeByName(coinType));
  return data[0].metadata;
};

export const getAmount = (amount: string, meta: TokenMetadata) => {
  const v = parseFloat(amount);
  return BigInt(v * 10 ** meta.decimals);
};

const whitelistTokensAliases = new Map<string, string>();
/**
 * Get coin type by name/alias or return the same name if not found
 * @param name
 */
const getCoinTypeByName = (name: string) => {
  if (whitelistTokensAliases.size === 0) {
    for (const ct of loadWhitelistTokens()) {
      const coinName = ct.split("::")[2];
      whitelistTokensAliases.set(coinName, ct);
    }
  }

  if (whitelistTokensAliases.has(name)) {
    return whitelistTokensAliases.get(name);
  }
  return name;
};
