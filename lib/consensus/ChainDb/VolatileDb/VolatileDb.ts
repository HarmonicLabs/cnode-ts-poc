import { ChainPoint, isOriginPoint, isRealPoint, RealPoint } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { VolatileChain } from "./VolatileChain";
import { fromHex, toHex, uint8ArrayEq } from "@harmoniclabs/uint8array-utils";
import { logger } from "../../../../src/logger";
import { tryGetByronPoint, tryGetEBBPoint } from "../../../ledgerExtension/byron";
import { unlink, writeFile } from "fs/promises";
import { tryGetAlonzoPoint } from "../../../ledgerExtension/alonzo";
import { tryGetBabbagePoint } from "../../../ledgerExtension/babbage/tryGetBabbagePoint";
import { MultiEraHeader } from "../../../ledgerExtension/multi-era/MultiEraHeader";
import { eqChainPoint } from "../../../utils/eqChainPoint";
import { Peer } from "./getUniqueExtensions";
import { IHeader } from "../../../ledgerExtension/IHeader";
import { pointFromHeader } from "../../../utils/pointFromHeadert";
import { ChainDb } from "../ChainDb";
import { roDescr } from "../../../utils/roDescr";
import { createReadStream, createWriteStream, existsSync, mkdirSync, ReadStream } from "fs";
import { readFile } from "fs/promises";

export interface ChainFork {
    /** point in the main chain */
    intersection: RealPoint,
    /** continuation from intersection */
    fragment: RealPoint[],
}

export function eqChainFork( a: ChainFork, b: ChainFork )
{
    return eqChainPoint( a.intersection, b.intersection ) && (
        a.fragment.length === b.fragment.length &&
        a.fragment.every(( apnt, i ) => eqChainPoint( apnt, b.fragment[i] ) )
    );
}

export interface ChainForkHeaders {
    intersection: RealPoint,
    fragment: MultiEraHeader[]
}

export function eqChainForkHeaders( a: ChainForkHeaders, b: ChainForkHeaders )
{
    return eqChainPoint( a.intersection, b.intersection ) && (
        a.fragment.length === b.fragment.length &&
        a.fragment.every(( ahdr, i ) => uint8ArrayEq( ahdr.hash, b.fragment[i].hash ) )
    );
}

export function forkHeadersToPoints( forkHeaders: ChainForkHeaders ): ChainFork
{
    return {
        ...forkHeaders,
        fragment: forkHeaders.fragment.map( pointFromHeader )
    };
}

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

function pointOrd( a: RealPoint, b: RealPoint )
{
    return Number( BigInt( a.blockHeader.slotNumber ) - BigInt( b.blockHeader.slotNumber ) );
}

export class VolatileDb
{
    readonly path: string;
    readonly chainDb: ChainDb;
    /**
     * tip of the main chain
    **/
    get tip(): RealPoint
    {
        return this.main[ this.main.length - 1 ];
    }
    /**
     * tip of immutable chain
     * (aka. maximum point to rollback to)
    **/
    get anchor(): RealPoint
    {
        return this.main[0];
    }

    /**
     * @readonly
     * main chain followed
     */
    readonly main: RealPoint[]

    /**
     * @readonly
     * known forks
     */
    readonly forks: ChainFork[]

    /**
     * @readonly
     * blocks that wasn't possible to connect to any known chain
     * ( migth turn useful for possible future forks )
     * 
     *  will be garbage collected once anchor slot becomes greather
    **/
    readonly orphans: RealPoint[]

    /**
     * @readonly
     * blocks that are now immutable but still in the volatileDb
     * 
     * these are moved in chunks of 100 blocks
     */
    readonly immutable: RealPoint[]

    constructor( fullPath: string, chainDb: ChainDb )
    {
        createDbDirs( fullPath );
        Object.defineProperties(
            this, {
                path: { value: fullPath.toString(), ...roDescr },
                chainDb: { value: chainDb, ...roDescr },
                main : { value: [], ...roDescr },
                forks: { value: [], ...roDescr },
                orphans  : { value: [], ...roDescr },
                immutable: { value: [], ...roDescr },
            }
        );
    }

    async putBlock( header: MultiEraHeader, blockByets: Uint8Array ): Promise<void>
    {
        const point = pointFromHeader( header );
        const headerBytes = header.toCborBytes();

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

    async resolvePoint( point: RealPoint ): Promise<MultiEraHeader | undefined>
    {
        const hashStr = toHex( point.blockHeader.hash );
        const hdrPath = `${this.path}/headers/${hashStr}-${point.blockHeader.slotNumber}`;
        
        if( !existsSync( hdrPath ) )return undefined;
        
        return MultiEraHeader.fromCbor(
            new Uint8Array( 
                await readFile( hdrPath )
            )
        );
    }

    async extendMain( extension: MultiEraHeader ): Promise<void>
    {
        const pt = pointFromHeader( extension );
        if(
            !uint8ArrayEq(
                this.tip.blockHeader.hash,
                extension.prevHash
            )
        ) {
            logger.warn("incorrect extension for main chain");
            return;
        }
        logger.info("chain extended: " + toHex( extension.hash ) );
        this.main.push( pt );

        // some blocks are now immutable
        if( this.main.length > this.chainDb.cfg.k )
        {
            const immutable = this.main.splice( 0, this.main.length - this.chainDb.cfg.k );
            this.immutable.push( ...immutable );

            for( let i = 0; i < this.forks.length;)
            {
                const { intersection, fragment } = this.forks[i];
                if( immutable.some( pnt => eqChainPoint( pnt, intersection ) ) )
                {
                    // fork intersection older than k
                    // we will never switch to this fork
                    // move to orphans for future garbage collection
                    this.orphans.push( ...fragment );
                }
                else i++;
            }
        }

        if( this.immutable.length >= 100 ) await this.garbageCollection();
    }

    /**
     * moves immutable blocks ti immutable db
     * 
     * removes orphans older than anchor (by slot)
     */
    async garbageCollection(): Promise<void>
    {
        logger.info("performing garbage collection");

        // first move to immutable and only after that delete things
        const blockPaths = this.immutable.map( pnt => `${this.path}/blocks/${toHex( pnt.blockHeader.hash )}-${pnt.blockHeader.slotNumber}` );

        const immutablePath = `${this.chainDb.immutableDb.path}/${this.chainDb.immutableDb.chunks}.chunk`;
        logger.info("moving", this.immutable.length, "blocks to file", immutablePath );

        if( existsSync( immutablePath ) ) await unlink( immutablePath );
        
        // concat immutable blocks
        const immutableFile = createWriteStream( immutablePath );
        this.chainDb.immutableDb.chunks++;
        for( const path of blockPaths )
        {
            const bytes  = await readFile( path );
            await new Promise<void>((res, rej) => {
                immutableFile.write( bytes,( err ) => {
                    if( err ) rej( err );
                    res();
                });
            });
        }
        immutableFile.close();

        const anchor = BigInt( this.anchor.blockHeader.slotNumber );
        const oldOrphans = this.orphans.filter( pnt => pnt.blockHeader.slotNumber < anchor );
        oldOrphans.forEach( pnt => {
            const idx = this.orphans.indexOf( pnt );
            if( idx < 0 ) return;
            void this.orphans.splice( idx, 1 );
        });

        // remove orphans and immmutable from volatile
        await Promise.all(
            blockPaths
            .concat( // headerPaths (immutable)
                this.immutable.map( pnt => `${this.path}/headers/${toHex( pnt.blockHeader.hash )}-${pnt.blockHeader.slotNumber}` )
            )
            .concat(
                oldOrphans.map( pnt => `${this.path}/blocks/${toHex( pnt.blockHeader.hash )}-${pnt.blockHeader.slotNumber}` )
            )
            .concat(
                oldOrphans.map( pnt => `${this.path}/headers/${toHex( pnt.blockHeader.hash )}-${pnt.blockHeader.slotNumber}` )
            )
            .map( removeFileIfPresent )
        );

        this.immutable.length = 0;

        logger.info("garbage collection done");
    }

    /**
     * @returns {number | undefined} the number of blocks between the point and the tip (tip included; point excluded)
     * or `undefined` if the point is not present in the main chain;
     * 
     * currently `O(n)` but it could be `O(1)` by looking at block numbers
     */
    getDistanceFromTipSync( point: RealPoint ): number | undefined
    {
        for( let distance = 0; distance < this.main.length; distance++ )
        {
            if(
                eqChainPoint(
                    this.main[ this.main.length - distance - 1 ],
                    point
                )
            ) return distance;
        }
        return undefined;
    }

    /**
     * switches to a fork only if strictly longer 
     */
    trySwitchToForkSync( forkIndex: number ): void
    {
        const fork = this.forks[forkIndex];
        if( !fork ) return;

        const mainDistance = this.getDistanceFromTipSync( fork.intersection );
        if( !mainDistance )
        {
            logger.error("fork intersection missing");
            this.forks.splice( this.forks.indexOf( fork ), 1 );
            this.orphans.push( ...fork.fragment );
            return;
        }
        else if( mainDistance >= fork.fragment.length ) return; // don't switch

        logger.info(
            "switching to fork with tip: ",
            fork.fragment[ fork.fragment.length - 1 ].toString()
        );

        const tmp = this.main.splice( mainDistance + 1 );
        this.main.push( ...fork.fragment );
        fork.fragment = tmp;
    }
}


function createDbDirs( basePath: string ): void
{
    if( !existsSync( basePath ) )
    {
        mkdirSync( basePath );
    }
    if( !existsSync( basePath + "/blocks" ) )
    {
        mkdirSync( basePath + "/blocks" );
    }
    if( !existsSync( basePath + "/headers" ) )
    {
        mkdirSync( basePath + "/headers" );
    }
}

async function removeFileIfPresent( path: string ): Promise<void>
{
    if( !existsSync( path ) ) return;
    return unlink( path );    
}