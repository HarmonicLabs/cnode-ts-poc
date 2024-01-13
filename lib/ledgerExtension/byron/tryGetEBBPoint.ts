import { Cbor, CborArray, CborBytes, CborUInt, LazyCborArray } from "@harmoniclabs/cbor";
import { ChainPoint } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { blake2b_256 } from "../../crypto";
import { logger } from "../../../src/logger";

export function tryGetEBBPoint( headerBytes: Uint8Array ): ChainPoint | undefined
{
    const lazyHead = Cbor.parseLazy( headerBytes );

    if(!(
        lazyHead instanceof LazyCborArray &&
        lazyHead.array.length === 5
    )){
        return undefined;
    }
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
        lazyEbbConsensusData.array.length === 2
    )) return undefined;

    const epochIdCbor = Cbor.parse( lazyEbbConsensusData.array[0] );

    if(!(
        epochIdCbor instanceof CborUInt
    )) return undefined;

    const epochId = epochIdCbor.num; 

    return new ChainPoint({
        blockHeader: {
            // byron is a pain
            // the hash is calculated wrapping the header in the second slot of an array
            // the first slot is uint(0) for EBB and uint(1) for normal byron blocks
            hash: blake2b_256( new Uint8Array([ 0x82, 0x00, ...headerBytes ]) ),
            slotNumber: epochId * BigInt( 21600 )
        }
    });
}