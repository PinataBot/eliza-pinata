import {WalrusPutResponse} from "../types/walrusTypes.ts";

const PUBLISHER_URL = "https://publisher.walrus-testnet.walrus.space";


export async function putBlob(data: string): Promise<string> {
    try {
        const response = await fetch(`${PUBLISHER_URL}/v1/blobs`, {
            method: "PUT",
            body: data,
            headers: {
                "Content-Type": "text/plain", // Adjust the content type if needed
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: WalrusPutResponse = await response.json(); // or response.json() if the response is JSON
        console.log("Response:", result);

        if (result.newlyCreated) {
            return result.newlyCreated.blobObject.blobId;
        } else if (result.alreadyCertified) {
            return result.alreadyCertified.blobId;
        } else {
            console.error('Unexpected response structure:', result);
            return null;
        }
    } catch (error) {
        console.error("Error:", error);
    }
}