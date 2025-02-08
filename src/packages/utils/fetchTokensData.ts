export async function fetchTokenData(coinType: string) {
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
    return data;
  } catch (error) {
    console.error(`Attempt failed:`, error);
    return null;
  }
}
