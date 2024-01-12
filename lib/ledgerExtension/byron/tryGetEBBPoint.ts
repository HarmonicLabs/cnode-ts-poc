import { Cbor, CborArray, CborBytes, CborUInt, LazyCborArray } from "@harmoniclabs/cbor";
import { ChainPoint } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { blake2b_256 } from "../../crypto";

export function tryGetEBBPoint( headerBytes: Uint8Array ): ChainPoint | undefined
{
    const lazyHead = Cbor.parseLazy( headerBytes );

    if(!(
        lazyHead instanceof LazyCborArray &&
        lazyHead.array.length === 5
    )) return undefined;

    const thirdLazy = Cbor.parseLazy( lazyHead.array[2] );

    if(!(
        thirdLazy instanceof CborBytes &&
        thirdLazy.buffer.length === 32
    ))
    {
        // third element not bytes (blake2b-256 ebb block body hash) implies this should be a normal byron block
        return undefined;
    }

    const lazyEbbConsensusData = Cbor.parseLazy( lazyHead.array[3] );

    if(!(
        lazyEbbConsensusData instanceof LazyCborArray &&
        lazyEbbConsensusData.array.length === 4
    )) return undefined;

    const slotId = Cbor.parse( lazyEbbConsensusData.array[0] );

    if(!(
        slotId instanceof CborArray &&
        slotId.array.length === 2 &&
        slotId.array[0] instanceof CborUInt &&
        slotId.array[1] instanceof CborUInt
    )) return undefined;

    const epochId = slotId.array[0].num; 
    // const slot = slotId.array[1].num;

    return new ChainPoint({
        blockHeader: {
            hash: blake2b_256( headerBytes ),
            slotNumber: epochId * BigInt( 21600 )
        }
    });
}