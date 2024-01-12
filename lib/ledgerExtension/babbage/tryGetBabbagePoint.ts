import { Cbor, CborUInt, LazyCborArray } from "@harmoniclabs/cbor";
import { ChainPoint } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { blake2b_256 } from "../../crypto";

export function tryGetBabbagePoint( headerBytes: Uint8Array ): ChainPoint | undefined
{
    const lazyHead = Cbor.parseLazy( headerBytes );

    if(!(
        lazyHead instanceof LazyCborArray &&
        lazyHead.array.length === 2
    )) return undefined;

    const lazyHeaderBody = Cbor.parseLazy( lazyHead.array[0] );

    if(!(
        lazyHeaderBody instanceof LazyCborArray &&
        lazyHeaderBody.array.length === 10
    ))
    {
        return undefined;
    }

    const slot = Cbor.parse( lazyHeaderBody.array[1] );

    if(!(slot instanceof CborUInt)) return undefined;

    return new ChainPoint({
        blockHeader: {
            hash: blake2b_256( headerBytes ),
            slotNumber: slot.num
        }
    });
}