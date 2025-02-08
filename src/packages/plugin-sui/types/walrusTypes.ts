export type WalrusPutResponse =
    | { newlyCreated: NewlyCreated }
    | { alreadyCertified: AlreadyCertified };

export interface NewlyCreated {
    blobObject: {
        id: string
        registeredEpoch: number
        blobId: string
        size: number
        encodingType: string
        certifiedEpoch: number
        storage: {
            id: string
            startEpoch: number
            endEpoch: number
            storageSize: number
        }
        deletable: boolean
    }
    resourceOperation: {
        registerFromScratch: {
            encodedLength: number
            epochsAhead: number
        }
    }
    cost: number
}


export interface AlreadyCertified {
    blobId: string
    event: {
        txDigest: string
        eventSeq: string
    }
    endEpoch: number
}
