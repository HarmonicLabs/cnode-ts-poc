import { ChainPoint, isOriginPoint, isRealPoint, RealPoint } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { VolatileChain } from "./VolatileChain";
import { fromHex, toHex } from "@harmoniclabs/uint8array-utils";
import { logger } from "../../../../src/logger";
import { tryGetByronPoint, tryGetEBBPoint } from "../../../ledgerExtension/byron";
import { writeFile } from "fs/promises";
import { tryGetAlonzoPoint } from "../../../ledgerExtension/alonzo";
import { tryGetBabbagePoint } from "../../../ledgerExtension/babbage/tryGetBabbagePoint";

export interface BlockInfos {
    hash: Uint8Array,
    slotNo: number,
    blockNo: number,
    prevHash: Uint8Array,
    isEBB: boolean,
    headerOffset: number,
    headerSize: number
}

export type LookupBlockInfosFn = ( hash: Uint8Array ) => (BlockInfos | undefined) 

export interface ChainDiff {
    nBlocksBehind: number,
    intersection: ChainPoint,
    extension: RealPoint[]
}

export interface ChainFork {
    intersection: ChainPoint
    rest: RealPoint[]
}

export interface Chains {
    main: VolatileChain
    forks: ChainFork[]
}

export class VolatileDb
{
    readonly path: string
    readonly invalidBlocks: Set<string /* block hash */>
    tipPoint: RealPoint
    
    private _chains: Chains
    
    constructor( fullPath: string )
    {
        let _tipPoint: ChainPoint
        let _chains: Chains
        Object.defineProperties(
            this, {
                path: {
                    value: fullPath.toString(),
                    writable: false,
                    enumerable: true,
                    configurable: false
                },
                invalidBlocks: {
                    value: new Map(),
                    writable: false,
                    enumerable: false,
                    configurable: false
                },
                tipPoint: {
                    get: () => _tipPoint,
                    set: ( newPoint: RealPoint ) =>
                    {
                        if( isRealPoint( newPoint ) ) _tipPoint = new RealPoint( newPoint );
                        return newPoint;
                    },
                    enumerable: false,
                    configurable: false
                }
            }
        )
    }

    async putBlock( headerBytes: Uint8Array, blockByets: Uint8Array ): Promise<void>
    {
        const point =
            tryGetEBBPoint( headerBytes ) ??
            tryGetByronPoint( headerBytes ) ??
            tryGetAlonzoPoint( headerBytes ) ??
            tryGetBabbagePoint( headerBytes );

        if(!(point instanceof RealPoint))
        {
            logger.error("unrecognized block header; " + toHex( headerBytes ) );
            throw new Error("unrecognized block header");
        }

        const hashStr = toHex( point.blockHeader.hash );
        const hdrPath = `${this.path}/headers/${hashStr}-${point.blockHeader.slotNumber}`;
        const blockPath = `${this.path}/blocks/${hashStr}-${point.blockHeader.slotNumber}`;

        await Promise.all([
            writeFile( hdrPath, headerBytes ),
            writeFile( blockPath, blockByets ),
        ]);
    }

    async getBlockInfos( hash: string | Uint8Array ): Promise<BlockInfos | undefined>
    {
        hash = hash instanceof Uint8Array ? hash : fromHex( hash );
        return undefined;
    }

    /**
     * in `ouroboros-consensus` called `isReachable`
     * (https://github.com/IntersectMBO/ouroboros-consensus/blob/982eff4ac03192d0685a9bc04431074d0943e7cb/ouroboros-consensus/src/ouroboros-consensus/Ouroboros/Consensus/Storage/ChainDB/Impl/Paths.hs#L372)
     * 
     * @returns {ChainDiff | undefined}
     */
    async canSwitchTo( point: RealPoint ): Promise<ChainDiff | undefined>
    {
        if( !isRealPoint( point ) )
        {
            logger.error("unreachable 'canSwitchTo'");
            return undefined;
        }

        const blockInfos = await this.getBlockInfos( point.blockHeader.hash );
        if( !blockInfos ) return undefined;

        let nRollback = 0;
    }
}