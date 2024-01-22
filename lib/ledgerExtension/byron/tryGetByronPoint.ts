import { Cbor, CborArray, CborUInt, LazyCborArray } from "@harmoniclabs/cbor";
import { RealPoint } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { blake2b_256 } from "../../crypto";

export function tryGetByronPoint( headerBytes: Uint8Array ): RealPoint | undefined
{
    const lazyHead = Cbor.parseLazy( headerBytes );

    if(!(
        lazyHead instanceof LazyCborArray &&
        lazyHead.array.length === 5
    )) return undefined;

    const lazyConsensusData = Cbor.parseLazy( lazyHead.array[3] );

    const thirdLazy = Cbor.parseLazy( lazyHead.array[2] );

    if(!(
        thirdLazy instanceof LazyCborArray &&
        thirdLazy.array.length === 4
    ))
    {
        // third element not array implies this should be an ebb block
        return undefined;
    }

    if(!(
        lazyConsensusData instanceof LazyCborArray &&
        lazyConsensusData.array.length === 4
    )) return undefined;

    const slotId = Cbor.parse( lazyConsensusData.array[0] );

    if(!(
        slotId instanceof CborArray &&
        slotId.array.length === 2 &&
        slotId.array[0] instanceof CborUInt &&
        slotId.array[1] instanceof CborUInt
    )) return undefined;

    const epochId = slotId.array[0].num; 
    const slot = slotId.array[1].num;

    return new RealPoint({
        blockHeader: {
            // byron is a pain
            // the hash is calculated wrapping the header in the second slot of an array
            // the first slot is uint(0) for EBB and uint(1) for normal byron blocks
            hash: blake2b_256( new Uint8Array([ 0x82, 0x01, ...headerBytes ]) ),
            slotNumber: epochId * BigInt( 21600 ) + slot
        }
    });
}