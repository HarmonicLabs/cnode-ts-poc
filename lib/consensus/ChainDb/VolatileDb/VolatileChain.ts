import { isObject } from "@harmoniclabs/obj-utils";
import { ChainPoint, IChainPoint, IRealPoint, RealPoint, isIChainPoint, isRealPoint } from "@harmoniclabs/ouroboros-miniprotocols-ts";

export interface IVolatileChain {
    anchor: IChainPoint,
    extension: IRealPoint[]
}

export function isIVolatileChain( thing: any ): thing is IVolatileChain
{
    return (
        isObject( thing ) &&
        isIChainPoint( thing.anchor ) &&
        Array.isArray( thing.extension ) && thing.extension.every( isRealPoint )
    );
}

export class VolatileChain
    implements IVolatileChain
{
    readonly anchor: ChainPoint;
    readonly extension: RealPoint[];

    constructor( chain: IVolatileChain )
    {
        const self = this;
        Object.defineProperties(
            this, {
                anchor: {
                    value: new ChainPoint( chain.anchor ),
                    writable: false,
                    enumerable: true,
                    configurable: false
                },
                extension: {
                    value: chain.extension.map( p => new RealPoint(p) ),
                    writable: false,
                    enumerable: true,
                    configurable: false
                },
                [Symbol.iterator]: {
                    value: function*()
                    {
                        yield self.anchor;
                        for( let i = 0; i < self.extension.length; ) yield self.extension[i++]
                    },
                    writable: false,
                    enumerable: false,
                    configurable: false
                }
            }
        );
    }
}