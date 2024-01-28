import { BlockFetchClient, BlockFetchNoBlocks, ChainPoint, ChainSyncClient, ChainSyncIntersectFound, ChainSyncRollBackwards, ChainSyncRollForward, MiniProtocol, Multiplexer, MultiplexerHeader, RealPoint } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { logger } from "./logger";
import { Socket } from "net";
import { existsSync, mkdir, mkdirSync, writeFile, writeFileSync } from "fs";
import { tryGetByronPoint, tryGetEBBPoint } from "../lib/ledgerExtension/byron";
import { tryGetAlonzoPoint } from "../lib/ledgerExtension/alonzo";
import { tryGetBabbagePoint } from "../lib/ledgerExtension/babbage/tryGetBabbagePoint";
import { appendFile } from "fs/promises";
import { Cbor, CborBytes, CborUInt, LazyCborArray } from "@harmoniclabs/cbor";
import { LazyCborTag } from "@harmoniclabs/cbor/dist/LazyCborObj/LazyCborTag";
import { fromHex, toHex } from "@harmoniclabs/uint8array-utils";
import { MultiEraHeader } from "../lib/ledgerExtension/multi-era/MultiEraHeader";
import { pointFromHeader } from "../lib/utils/pointFromHeadert";

export async function runNode( connections: Multiplexer[], batch_size: number ): Promise<void>
{
    // temporarily just consider 2 connections
    while( connections.length > 1 ) connections.pop();

    createDbDirs()

    const chainSyncClients = connections.map( mplexer => new ChainSyncClient( mplexer ) );
    const blockFetchClients = connections.map( mplexer => new BlockFetchClient( mplexer ) );

    chainSyncClients.forEach( client => {
        client.once("awaitReply", () =>
            logger.info(
                "reached tip on peer",
                (client.mplexer.socket.unwrap() as Socket).remoteAddress
            )
        );
    });
    blockFetchClients.forEach( client => {
        client.on("error", logger.error );
    });

    let start: ChainPoint | undefined = undefined;
    let curr_batch_size = 0;
    let prev: ChainPoint | undefined =  undefined;

    while( true )
    {
        const nextHeaders = await Promise.all( chainSyncClients.map( client => client.requestNext() ));
    
        for( const next of nextHeaders )
        {
            if( next instanceof ChainSyncRollForward )
            {
                // save header to the disk and get header point
                const point = saveHeaderAndGetPoint( next, "./db/headers" );
    
                // if no start present, set start to header point
                if(!(start instanceof ChainPoint) ) start = point;

                // increment current batch size
                curr_batch_size++;

                // if current batch size >= expected batch size
                // fetch the blocks and save them to disk
                if( curr_batch_size >= batch_size )
                {
                    await fetchAndSaveBlocks( blockFetchClients[0], new ChainPoint( start ), new ChainPoint( point ), "./db/blocks");
                    start = undefined;
                    curr_batch_size = 0;
                };
    
                // save header point as last one got in case of next msg is rollback
                prev = point;
            }
            else if( next instanceof ChainSyncRollBackwards )
            {
                // if we have a batch start point AND a last fetched point
                // fetch the blocks and save them to disk
                if(
                    start instanceof ChainPoint &&
                    prev instanceof ChainPoint
                ) {
                    await fetchAndSaveBlocks( blockFetchClients[0], start, prev, "./db/blocks" );
                }
                start = undefined;
            }
        }
    }
}

function saveHeaderAndGetPoint( msg: ChainSyncRollForward, basePath: string ): ChainPoint
{
    const msgDataBytes = msg.getDataBytes();
    const multiEraHeader = MultiEraHeader.fromCbor( msgDataBytes );
    const point = pointFromHeader( multiEraHeader.header );

    /*
    const headerBytes = getHeaderBytes( msg.getDataBytes() );
    const point =
        tryGetEBBPoint( headerBytes ) ??
        tryGetByronPoint( headerBytes ) ??
        tryGetAlonzoPoint( headerBytes ) ??
        tryGetBabbagePoint( headerBytes );
    */

    if(!(point instanceof RealPoint))
    {
        logger.error("unrecognized block header; msgDataBytes: " + toHex( msgDataBytes ) );
        throw new Error("unrecognized block header");
    }

    const hashStr = toHex( point.blockHeader.hash );
    const path = `${basePath}/${hashStr}-${point.blockHeader?.slotNumber}`;

    const bytes = multiEraHeader.header.toCborBytes();
    writeFile( path, bytes, () => {});
    logger.info(multiEraHeader.eraIndex,`wrote ${bytes.length} bytes long header in file "${path}"`);

    return point;
}

async function fetchAndSaveBlocks(
    client: BlockFetchClient,
    startPoint: ChainPoint,
    endPoint: ChainPoint,
    basePath: string
): Promise<void>
{
    // logger.info("requestRange: " + startPoint.toString() + " - " + endPoint.toString());
    const blocksMsgs = await client.requestRange( startPoint, endPoint );
    
    if( blocksMsgs instanceof BlockFetchNoBlocks || !Array.isArray( blocksMsgs ) )
    {
        logger.error(
            "unable to fetch blocks;",
            "startPoint: " + JSON.stringify( startPoint.toJson() ),
            "endPoint: " + JSON.stringify( endPoint.toJson() ),
            blocksMsgs
        );
        client.done();
        throw new Error("unable to fetch blocks");
        return;
    };
    const blocks = blocksMsgs.map( msg => msg.getBlockBytes() );
    const hashStr = toHex( startPoint.blockHeader?.hash ?? new Uint8Array() );
    const path = `${basePath}/${hashStr}-${startPoint.blockHeader?.slotNumber}`;
    let totBytes = 0;

    for( const block of blocks )
    {
        await appendFile( path, block );
        totBytes += block.length;
    };
    // logger.info(
    //     "saving " + blocks.length +
    //     " blocks in file \"" + path + 
    //     "\" for a total of " + totBytes + " bytes"
    // );
}

function createDbDirs(): void
{
    if( !existsSync("./db") )
    {
        mkdirSync("./db");
    }
    if( !existsSync("./db/blocks") )
    {
        mkdirSync("./db/blocks");
    }
    if( !existsSync("./db/headers") )
    {
        mkdirSync("./db/headers");
    }
}