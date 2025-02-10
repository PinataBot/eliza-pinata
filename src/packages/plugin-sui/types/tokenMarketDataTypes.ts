/******************************************************
 * 1. Raw Interfaces
 ******************************************************/

export type CoinsInfo = CoinInfo[];

export interface CoinInfo {
  isMintable: string;
  tokensBurned: string;
  tokensBurnedPercentage: string;
  lpBurnt: string;
  coinSupply: string;
  coinMetadata: CoinMetadata;
  tokensInLiquidity: string;
  tokensInBurntLp: string;
  suiInBurntLp: string;
  percentageTokenSupplyInBurntLp: string;
  percentageTokenSupplyInLiquidity: string;
  isCoinHoneyPot: string;
  suspiciousActivities: any[];
  top10HolderPercentage: string;
  top20HolderPercentage: string;
  fullyDilutedMarketCap: string;
  marketCap: string;
  totalLiquidityUsd: string;
  timeCreated: string;
  coin: string;
  coinDev: string;
  price5mAgo: string;
  price1hAgo: string;
  price6hAgo: string;
  price24hAgo: string;
  percentagePriceChange5m: string;
  percentagePriceChange1h: string;
  percentagePriceChange6h: string;
  percentagePriceChange24h: string;
  coinDevHoldings: string;
  coinDevHoldingsPercentage: string;
  buyVolume5m: string;
  buyVolume1h: string;
  buyVolume6h: string;
  buyVolume24h: string;
  sellVolume5m: string;
  sellVolume1h: string;
  sellVolume6h: string;
  sellVolume24h: string;
  volume5m: string;
  volume1h: string;
  volume6h: string;
  volume24h: string;
  coinPrice: string;
  advancedScores: AdvancedScores;
}

export interface CoinMetadata {
  _id: string;
  coinType: string;
  decimals: string;
  description: string;
  iconUrl: string;
  id: string;
  name: string;
  symbol: string;
  dev: string;
  supply: string;
  createdAt: string;
  lastTradeAt: string;
}

export interface AdvancedScores {
  _id: string;
  coin: string;
  updatedAt: string;
  holdersWithProminentNft: string;
  holdersWithSuiNs: string;
  averageAgeOfHolders: string;
  holderQualityScore: string;
  volumeMin: string;
  volumeMax: string;
  volumeMean: string;
  volumeStdDev: string;
  volumeScore: string;
  liqMin: string;
  liqMax: string;
  liqMean: string;
  liqStdDev: string;
  liqScore: string;
  uniqueUsersMin: string;
  uniqueUsersMax: string;
  uniqueUsersMean: string;
  uniqueUsersStdDev: string;
  uniqueUsersScore: string;
  tradePerUserMin: string;
  tradePerUserMax: string;
  tradePerUserMean: string;
  tradePerUserStdDev: string;
  tradePerUserScore: string;
  uniqueBuyers7d: string;
  uniqueSellers7d: string;
  uniqueBuyers14d: string;
  uniqueSellers14d: string;
  totalTrades7d: string;
  uniqueBuyersWithVolumeMoreThan500_7d: string;
  uniqueSellersWithVolumeMoreThan500_7d: string;
  uniqueBuyersWithVolumeMoreThan500_14d: string;
  uniqueSellersWithVolumeMoreThan500_14d: string;
  uniqueBuyersWithVolumeMoreThan1000_7d: string;
  uniqueSellersWithVolumeMoreThan1000_7d: string;
  uniqueBuyersWithVolumeMoreThan1000_14d: string;
  uniqueSellersWithVolumeMoreThan1000_14d: string;
}

/******************************************************
 * 2. Filtered Interfaces (only the most important fields)
 ******************************************************/

export type FilteredCoinsInfo = FilteredCoinInfo[];

// 2a. Filtered metadata that excludes iconUrl
export interface FilteredCoinMetadata {
  _id: string;
  coinType: string;
  decimals: number;
  description: string;
  id: string;
  name: string;
  symbol: string;
  dev: string;
  supply: number;
  createdAt: number;
  lastTradeAt: number;
}

// 2b. Filtered Coin Info
export interface FilteredCoinInfo {
  mint: boolean;
  lpB: boolean;
  sup: number;
  liqUsd: number;
  liqPct: number;
  hp: boolean;
  mc: number;
  fdmc: number;
  price: number;
  chg: number[]; // [5m, 1h, 6h, 24h] price change
  volBuy: number[]; // [5m, 1h, 6h, 24h] buy volume
  volSell: number[]; // [5m, 1h, 6h, 24h] sell volume
  vol: number[]; // [5m, 1h, 6h, 24h] total volume
  top10H: number;
  top20H: number;
  devH: number;
  devHPct: number;
  metadata: FilteredCoinMetadata;
}

/******************************************************
 * 3. Filtering Function
 ******************************************************/

export function filterCoinsInfo(rawData: CoinsInfo): FilteredCoinsInfo {
  return rawData.map((coin: CoinInfo) => ({
    // Core properties (shortened names)
    mint: coin.isMintable === "true",
    lpB: coin.lpBurnt === "true",
    sup: Number(coin.coinSupply),
    liqUsd: Number(coin.totalLiquidityUsd),
    liqPct: Number(coin.percentageTokenSupplyInLiquidity),
    hp: coin.isCoinHoneyPot === "true",
    mc: Number(coin.marketCap),
    fdmc: Number(coin.fullyDilutedMarketCap),
    price: Number(coin.coinPrice),

    // Grouped price change percentages
    chg: [
      Number(coin.percentagePriceChange5m),
      Number(coin.percentagePriceChange1h),
      Number(coin.percentagePriceChange6h),
      Number(coin.percentagePriceChange24h),
    ],

    // Grouped buy volumes
    volBuy: [
      Number(coin.buyVolume5m),
      Number(coin.buyVolume1h),
      Number(coin.buyVolume6h),
      Number(coin.buyVolume24h),
    ],

    // Grouped sell volumes
    volSell: [
      Number(coin.sellVolume5m),
      Number(coin.sellVolume1h),
      Number(coin.sellVolume6h),
      Number(coin.sellVolume24h),
    ],

    // Grouped total volumes
    vol: [
      Number(coin.volume5m),
      Number(coin.volume1h),
      Number(coin.volume6h),
      Number(coin.volume24h),
    ],

    // Holder distributions
    top10H: Number(coin.top10HolderPercentage),
    top20H: Number(coin.top20HolderPercentage),
    devH: Number(coin.coinDevHoldings),
    devHPct: Number(coin.coinDevHoldingsPercentage),

    // Metadata (without iconUrl)
    metadata: {
      _id: coin.coinMetadata._id,
      coinType: coin.coinMetadata.coinType,
      decimals: Number(coin.coinMetadata.decimals),
      description: coin.coinMetadata.description,
      id: coin.coinMetadata.id,
      name: coin.coinMetadata.name,
      symbol: coin.coinMetadata.symbol,
      dev: coin.coinMetadata.dev,
      supply: Number(coin.coinMetadata.supply),
      createdAt: Number(coin.coinMetadata.createdAt),
      lastTradeAt: Number(coin.coinMetadata.lastTradeAt),
    },
  }));
}
