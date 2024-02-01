import { BlockFetchClient, BlockFetchNoBlocks, ChainPoint, ChainSyncClient, ChainSyncIntersectFound, ChainSyncRollBackwards, ChainSyncRollForward, MiniProtocol, Multiplexer, MultiplexerHeader, RealPoint, isRealPoint } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { logger } from "./logger";
import { Socket } from "net";
import { existsSync, mkdir, mkdirSync, writeFile, writeFileSync } from "fs";
import { appendFile } from "fs/promises";
import { fromHex, toHex, uint8ArrayEq } from "@harmoniclabs/uint8array-utils";
import { MultiEraHeader } from "../lib/ledgerExtension/multi-era/MultiEraHeader";
import { pointFromHeader } from "../lib/utils/pointFromHeadert";
import { ClientNext, getUniqueExtensions } from "../lib/consensus/ChainDb/VolatileDb/getUniqueExtensions";
import { downloadExtensions, downloadForks } from "../lib/consensus/ChainDb/VolatileDb/downloadBlocks";
import { ChainDb } from "../lib/consensus/ChainDb/ChainDb";
import { ChainFork, ChainForkHeaders, VolatileDb, forkHeadersToPoints } from "../lib/consensus/ChainDb/VolatileDb";

export async function runNode( connections: Multiplexer[], batch_size: number ): Promise<void>
{
    // temporarily just consider 2 connections
    while( connections.length > 1 ) connections.pop();

    const chainDB = new ChainDb("./db");

    const peers = connections.map( mplexer => 
        ({ 
            chainSync: new ChainSyncClient( mplexer ),
            blockFetch: new BlockFetchClient( mplexer )
        })
    );

    peers.forEach( ({ chainSync: client }) => {
        client.once("awaitReply", () =>
            logger.info(
                "reached tip on peer",
                (client.mplexer.socket.unwrap() as Socket).remoteAddress
            )
        );
        client.on("error", err => {
            logger.error( err );
            throw err;
        });
    });
    peers.forEach( ({ blockFetch: client }) => {
        client.on("error", err => {
            logger.error( err );
            throw err;
        });
    });

    const startPoint = new RealPoint({ 
        blockHeader: {
            hash: fromHex("76ae58684c96c281e61fef8def4fce4c400f59bf3d2f41b20aa97d0965b4aea2"),
            slotNumber: 50705698 
        }
    });

    await Promise.all(
        peers.map(
            async ({ chainSync: client }) => {
                await client.findIntersect([ startPoint ]);
                // rollback
                await client.requestNext();
            }
        )
    );

    const volaitileDb = chainDB.volatileDb;

    console.log( chainDB );
    volaitileDb.main.push( startPoint );

    while( true )
    {
        const nextHeaders = await Promise.all(
            peers.map( async peer => {
                return {
                    next: await peer.chainSync.requestNext(),
                    peer
                } as ClientNext;
            })
        );

        const { extensions, forks } = await getUniqueExtensions( nextHeaders );

        // only adds to volatileDb
        // does not do chain selection (aka. no extensions nor switch to fork)
        void await Promise.all([
            downloadExtensions( volaitileDb, extensions ),
            downloadForks( volaitileDb, forks )
        ]);

        chainSelectionForExtensions( volaitileDb, extensions.map(({ header }) => header ) );
        chainSelectionForForks( volaitileDb, forks );
    }
}


function chainSelectionForExtensions(
    volaitileDb: VolatileDb,
    extensions: MultiEraHeader[]
): void
{
    // assumption 4.1 ouroboros-consensus report
    // always prefer extension
    //
    // aka. if we have two chains of the same legth we stay on our own

    let currTip = volaitileDb.tip;
    let currTipHash = currTip.blockHeader.hash;

    // we get extensions via roll forwards by peers we are synced with
    // so either extends main or extends forks
    // we can omit checks for rollbacks

    // we process the main extension first (if present)
    // so that we can check fork extensions later using strict >
    const mainExtension = extensions.find( hdr => uint8ArrayEq( hdr.prevHash, currTipHash ) );
    if( mainExtension )
    {
        volaitileDb.main.push( pointFromHeader( mainExtension ) );
        void extensions.splice( extensions.indexOf( mainExtension ), 1 );
    }

    if( extensions.length === 0 ) return;

    const forks = volaitileDb.forks;

    for( const fork of forks )
    {
        const { fragment, intersection } = fork;
        currTip = fragment.length === 0 ? intersection : fragment[ fragment.length - 1 ];
        currTipHash = currTip.blockHeader.hash;

        for( const extension of extensions )
        {
            if( uint8ArrayEq( extension.prevHash, currTipHash ) )
            {
                logger.info("fork extended");
                fragment.push( pointFromHeader( extension ) );

                // so we don't check it later
                extensions.splice( extensions.indexOf( extension ), 1 );

                const mainDistance = volaitileDb.getDistanceFromTipSync( intersection );
                if( !mainDistance )
                {
                    logger.error("fork intersection missing");
                    forks.splice( forks.indexOf( fork ), 1 );
                    volaitileDb.orphans.push( ...fragment );
                    break;
                }
                else if( mainDistance < fragment.length )
                {
                    volaitileDb.trySwitchToForkSync( forks.indexOf( fork ) );
                }

                break;
            }
        }

        // no need to check other forks
        if( extensions.length === 0 ) break;
    }
}

function chainSelectionForForks(
    volaitileDb: VolatileDb,
    forks: ChainForkHeaders[]
)
{
    const forksPoint = forks.map( forkHeadersToPoints );
    volaitileDb.forks.push( ...forksPoint );

    for( const fork of forksPoint )
    {
        const { fragment, intersection } = fork;
        const mainDistance = volaitileDb.getDistanceFromTipSync( intersection );
        if( !mainDistance )
        {
            logger.error("fork intersection missing");
            volaitileDb.forks.splice( volaitileDb.forks.indexOf( fork ), 1 );
            volaitileDb.orphans.push( ...fragment );
            break;
        }
        else if( mainDistance < fragment.length )
        {
            volaitileDb.trySwitchToForkSync( volaitileDb.forks.indexOf( fork ) );
        }
    }
}