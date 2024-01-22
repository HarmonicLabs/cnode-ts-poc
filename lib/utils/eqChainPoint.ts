import { IChainPoint, isOriginPoint } from "@harmoniclabs/ouroboros-miniprotocols-ts";

export function eqChainPoint( a: IChainPoint, b: IChainPoint ): boolean
{
    const aOrigin = isOriginPoint( a );
    const bOrigin = isOriginPoint( b );
    if( aOrigin && bOrigin ) return true;
    if( aOrigin || bOrigin ) return false;
    return (
        Number( a.blockHeader?.slotNumber ) === Number( b.blockHeader?.slotNumber ) &&
        a.blockHeader?.hash.toString() === b.blockHeader?.hash.toString()
    );
}