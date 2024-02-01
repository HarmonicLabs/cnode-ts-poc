import { BlockFetchNoBlocks } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { pointFromHeader } from "../../../utils/pointFromHeadert";
import { ChainFork, ChainForkHeaders, VolatileDb } from "./VolatileDb";
import { HeaderAndPeer, Peer } from "./getUniqueExtensions";
import { logger } from "../../../../src/logger";

export async function downloadExtensions( volatileDb: VolatileDb, extensions: HeaderAndPeer[] ): Promise<void>
{
    if( extensions.length === 0 ) return;
    logger.info("downloading extensions", extensions.length );
    await Promise.all(
        extensions.map( async ({ header, peer }) => {
            const point = pointFromHeader( header );
            const blockResponse = await peer.blockFetch.request( point );
            
            if( blockResponse instanceof BlockFetchNoBlocks )
            {
                logger.warn("couldn't find block of extension");
                return;
            }

            return volatileDb.putBlock( header, blockResponse.toCborBytes() );
        })
    );
}

export async function downloadForks( volatileDb: VolatileDb, forks: (ChainForkHeaders & Record<"peer", Peer>)[] ): Promise<void>
{
    if( forks.length === 0 ) return;
    logger.info("downloading forks");
    if( forks.length === 0 ) return;
    await Promise.all(
        forks.map( async ({ fragment, intersection, peer }) => {

            const forkTip = pointFromHeader( fragment[ fragment.length - 1 ] );
            const blockResponse = await peer.blockFetch.requestRange( intersection, forkTip );

            if( blockResponse instanceof BlockFetchNoBlocks )
            {
                logger.warn("couldn't find block of fork");
                return;
            }

            void blockResponse.shift();

            await Promise.all(
                blockResponse.map( ( b, i ) => {
                    const bytes = b.toCborBytes();
                    return volatileDb.putBlock( fragment[ i ], bytes );
                })
            );
        })
    )
}