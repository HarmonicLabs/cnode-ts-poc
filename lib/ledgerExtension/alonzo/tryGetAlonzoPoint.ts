import { Cbor, CborArray, CborBytes, CborUInt, LazyCborArray } from "@harmoniclabs/cbor";
import { RealPoint } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { blake2b_256 } from "../../crypto";

export function tryGetAlonzoPoint( headerBytes: Uint8Array ): RealPoint | undefined
{
    const lazyHead = Cbor.parseLazy( headerBytes );

    if(!(
        lazyHead instanceof LazyCborArray &&
        lazyHead.array.length === 2
    )) return undefined;

    const lazyHeaderBody = Cbor.parseLazy( lazyHead.array[0] );

    if(!(
        lazyHeaderBody instanceof LazyCborArray &&
        lazyHeaderBody.array.length >= 11
    ))
    {
        return undefined;
    }

    const slot = Cbor.parse( lazyHeaderBody.array[1] );

    if(!(slot instanceof CborUInt)) return undefined;

    return new RealPoint({
        blockHeader: {
            hash: blake2b_256( headerBytes ),
            slotNumber: slot.num
        }
    });
}