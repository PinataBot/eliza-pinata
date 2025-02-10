import { WalrusPutResponse } from "../types/walrusTypes.ts";
import { BlobItemType } from "../../adapter-supabase/types.ts";
import { IAgentRuntime, Memory, ServiceType, UUID } from "@elizaos/core";
import { SupabaseDatabaseAdapter } from "../../adapter-supabase/src";
import { SuiService } from "../services/sui.ts";
import { v4 as uuid } from "uuid";

const PUBLISHER_URL = "https://publisher.walrus-testnet.walrus.space";

export async function putBlob(data: string): Promise<{
  blobId: string;
  blobObjectId: string | null;
}> {
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
    console.log("Walrus put blob response:", result);

    if (result.newlyCreated) {
      return {
        blobId: result.newlyCreated.blobObject.blobId,
        blobObjectId: result.newlyCreated.blobObject.id,
      };
    } else if (result.alreadyCertified) {
      return {
        blobId: result.alreadyCertified.blobId,
        blobObjectId: null,
      };
    } else {
      console.error("Unexpected response structure:", result);
      return null;
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

export async function putBlobAndSave(
  runtime: IAgentRuntime,
  // for roomId, agentId, userId
  message: Memory,
  action:string,
  data: string,
  type: BlobItemType,
) {
  try {
    const { blobId, blobObjectId } = await putBlob(data);

    await runtime.messageManager.createMemory({
      ...message,
      id: uuid() as UUID,
      content: {
        text: data,
        blobId,
        action
      },
    });

    // save to db
    await (runtime.databaseAdapter as SupabaseDatabaseAdapter).createBlob({
      blobId,
      blobObjectId,
      content: data,
      type: type,
    });

    //add to nft
    await runtime
      .getService<SuiService>(ServiceType.TRANSCRIPTION)
      .addBlobToNft(blobId, type);
  } catch (error) {
    // TODO::add retry logic
    console.error("Can't put blob and save:", error);
  }
}
