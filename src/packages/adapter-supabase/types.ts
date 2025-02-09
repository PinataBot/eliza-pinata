import { UUID } from "@elizaos/core";

export type BlobItemType = "response" | "action";

export interface BlobItem {
  id?: UUID;
  blobId: string;
  blobObjectId: string;
  type: BlobItemType;
  content: string;
  createdAt?: Date;
}
