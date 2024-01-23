import { isObject } from "@harmoniclabs/obj-utils"
import { IRealPoint, RealPoint, isRealPoint } from "@harmoniclabs/ouroboros-miniprotocols-ts";

/**
 * immutable infos that any header needs to have
**/
export interface IHeader {
    readonly hash: Uint8Array & { readonly length: 32 },
    readonly prevHash: Uint8Array & { readonly length: 32 },
    readonly slotNo: bigint,
    // block number is not present on babbage headers
    // readonly blockNo: number,
    readonly isEBB: boolean,
    // ledger has no concept of "point"
    // it is just a consensus / network thing
    // readonly point: RealPoint
    // point?: () => IRealPoint

    // not really a consensus nor ledger thing
    // but turns useful for implementations
    readonly cborBytes?: Uint8Array
}

export function isIHeader( stuff: any ): stuff is IHeader
{
    return isObject( stuff ) && (
        (stuff.hash instanceof Uint8Array) &&
        stuff.hash.length === 32 &&

        (stuff.prevHash instanceof Uint8Array) &&
        stuff.prevHash.length === 32 &&

        Number.isSafeInteger( stuff.slotNo ) &&
        Number.isSafeInteger( stuff.blockNo ) &&
        typeof stuff.isEBB === "boolean" &&
        isRealPoint( stuff.point )
    );
}