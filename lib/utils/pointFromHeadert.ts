import { RealPoint } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { IHeader } from "../ledgerExtension/IHeader";

export function pointFromHeader( hdr: IHeader ): RealPoint
{
    return new RealPoint({
        blockHeader: {
            hash: hdr.hash,
            slotNumber: hdr.slotNo
        }
    });
}