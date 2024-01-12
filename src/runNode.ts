import { BlockFetchClient, ChainPoint, ChainSyncClient, ChainSyncRollBackwards, ChainSyncRollForward, Multiplexer } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { logger } from "./logger";
import { Socket } from "net";
import { writeFile, writeFileSync } from "fs";
import { tryGetByronPoint, tryGetEBBPoint } from "../lib/ledgerExtension/byron";
import { tryGetAlonzoPoint } from "../lib/ledgerExtension/alonzo";
import { tryGetBabbagePoint } from "../lib/ledgerExtension/babbage/tryGetBabbagePoint";

export async function runNode( connections: Multiplexer[], batch_size: number ): Promise<void>
{
    // temporarily just consider one connection
    while( connections.length > 1 ) connections.pop();

    const chainSyncClients = connections.map( mplexer => new ChainSyncClient( mplexer ) );
    const blockFetchClients = connections.map( mplexer => new BlockFetchClient( mplexer ) );

    chainSyncClients.forEach( client => {
        client.once("awaitReply", () =>
            logger.info(
                "reached tip on peer",
                (client.mplexer.socket.unwrap() as Socket).remoteAddress
            )
        )
    });

    let start: ChainPoint | undefined = undefined;
    let curr_batch_size = 0;
    let prev: ChainPoint | undefined =  undefined;

    while( true )
    {
        const nextHeaders = await Promise.all( chainSyncClients.map( client => client.requestNext() ));
    
        nextHeaders.forEach( next => {
            if( next instanceof ChainSyncRollForward )
            {
                // save header to the disk and get header point
                const point = saveHeaderAndGetPoint( next, "./db/headers" );
    
                // if no start present, set start to header point
                if(!( start instanceof ChainPoint )) start = point;
    
                // increment current batch size
                curr_batch_size++;

                // if current batch size >= expected batch size
                // fetch the blocks and save them to disk
                if( curr_batch_size >= batch_size )
                {
                    fetchAndSaveBlocks( blockFetchClients, new ChainPoint( start ), new ChainPoint( point ));
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
                    fetchAndSaveBlocks( blockFetchClients, start, prev );
                }
                start = undefined;
            }
        });
    }
}

function saveHeaderAndGetPoint( msg: ChainSyncRollForward, basePath: string ): ChainPoint
{
    const headerBytes = msg.getDataBytes();
    const point =
        tryGetEBBPoint( headerBytes ) ??
        tryGetByronPoint( headerBytes ) ??
        tryGetAlonzoPoint( headerBytes ) ??
        tryGetBabbagePoint( headerBytes );

    if(!(point instanceof ChainPoint))
    {
        logger.error("unrecognized block header; " + msg.toString());
        throw new Error("unrecognized block header");
    }
        
    const path = `${basePath}/${point.blockHeader?.hash}-${point.blockHeader?.slotNumber}`;

    writeFile( path, msg.toCborBytes(), () => {});

    return point;
}

async function fetchAndSaveBlocks(
    blockFetchClients: BlockFetchClient[],
    startPoint: ChainPoint,
    endPoint: ChainPoint
): Promise<void>
{

}