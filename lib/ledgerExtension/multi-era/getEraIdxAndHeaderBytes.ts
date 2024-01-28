import { Cbor, LazyCborArray, CborUInt, CborBytes } from "@harmoniclabs/cbor";
import { LazyCborTag } from "@harmoniclabs/cbor/dist/LazyCborObj/LazyCborTag";
import { toHex } from "@harmoniclabs/uint8array-utils";
import { logger } from "../../../src/logger";

export function getEraIdxAndHeaderBytes( multiEraHeaderBytes: Uint8Array ): {
    eraIdx: number,
    headerBytes: Uint8Array
}
{
    let lazy = Cbor.parseLazy( multiEraHeaderBytes );
    if(!(
        lazy instanceof LazyCborArray &&
        lazy.array.length === 2
    )) {
        logger.debug("not first array");
        logger.error( "unexpected roll forward data", lazy, toHex( multiEraHeaderBytes ) );
        throw new Error("unexpected roll forward data");
    }
    const eraIndexCbor = Cbor.parse( lazy.array[0] );
    if(!(eraIndexCbor instanceof CborUInt))
    {
        logger.debug("era index", eraIndexCbor);
        logger.error("invalid era index");
        throw new Error("invalid era index");
    }
    const eraIndex = eraIndexCbor.num;

    if( eraIndex === BigInt(0) ) return {
        eraIdx: 0,
        headerBytes: getOuroborsClassicHeader( lazy.array[1] )
    };

    lazy = Cbor.parseLazy( lazy.array[1] );
    if(!(
        lazy instanceof LazyCborTag &&
        lazy.data instanceof CborBytes
    ))
    {
        logger.debug("not cbor tag");
        logger.error( "unexpected roll forward data", lazy, toHex( multiEraHeaderBytes ) );
        throw new Error("unexpected roll forward data");
    }
    return {
        eraIdx: Number( eraIndex ),
        headerBytes: lazy.data.buffer
    };
}

function getOuroborsClassicHeader( wrappingBytes: Uint8Array )
{
    let lazy = Cbor.parseLazy( wrappingBytes );
    if(!(
        lazy instanceof LazyCborArray &&
        lazy.array.length === 2
    )) {
        logger.debug("not second array");
        logger.error( "unexpected roll forward data", lazy, toHex( wrappingBytes ) );
        throw new Error("unexpected roll forward data");
    }
    lazy = Cbor.parseLazy( lazy.array[1] );
    if(!(
        lazy instanceof LazyCborTag &&
        lazy.data instanceof CborBytes
    ))
    {
        logger.debug("not cbor tag");
        logger.error( "unexpected roll forward data", lazy, toHex( wrappingBytes ) );
        throw new Error("unexpected roll forward data");
    }
    return lazy.data.buffer;
}