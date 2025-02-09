import {
  filterCoinsInfo,
  FilteredCoinsInfo,
} from "../types/tokenMarketDataTypes.ts";

export async function fetchTokenData(
  coinType: string
): Promise<FilteredCoinsInfo> {
  try {
    const response = await fetch(
      `https://api.insidex.trade/external/coin-details?coins=${coinType}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `[Insidex Error] status: ${response.status}, message: ${errorText}`
      );
    }

    const data = await response.json();

    // Iterate over the tokens data and delete coinMetadata.iconUrl for each token.
    if (Array.isArray(data)) {
      data.forEach((token: any) => {
        if (token.coinMetadata && token.coinMetadata.iconUrl) {
          delete token.coinMetadata.iconUrl;
        }
      });
    } else if (data && typeof data === "object") {
      Object.values(data).forEach((token: any) => {
        if (token && token.coinMetadata && token.coinMetadata.iconUrl) {
          delete token.coinMetadata.iconUrl;
        }
      });
    }
    const filteredData = filterCoinsInfo(data);
    return filteredData;
  } catch (error) {
    console.error(`Attempt failed:`, error);
    return null;
  }
}
