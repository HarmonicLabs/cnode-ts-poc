import { RealPoint, ChainSyncRollForward, isRealPoint, ChainSyncRollBackwards, ChainSyncClient, BlockFetchClient } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { uint8ArrayEq } from "@harmoniclabs/uint8array-utils";
import { MultiEraHeader } from "../../../ledgerExtension/multi-era/MultiEraHeader";
import { eqChainPoint } from "../../../utils/eqChainPoint";
import { pointFromHeader } from "../../../utils/pointFromHeadert";
import { logger } from "../../../../src/logger";
import { ChainFork, ChainForkHeaders, eqChainFork, eqChainForkHeaders, forkHeadersToPoints } from "./VolatileDb";

export interface Peer {
    chainSync: ChainSyncClient,
    blockFetch: BlockFetchClient
}

export interface ClientNext {
    next: ChainSyncRollForward | ChainSyncRollBackwards,
    peer: Peer
}

export interface HeaderAndPeer {
    header: MultiEraHeader,
    peer: Peer
}

export async function getUniqueExtensions(
    nextHeaders: ClientNext[]
): Promise<{
    extensions: HeaderAndPeer[],
    forks: (ChainForkHeaders & Record<"peer", Peer>)[]
}>
{
    const extensions: HeaderAndPeer[] = [];
    const forks: (ChainForkHeaders & Record<"peer", Peer>)[] = [];

    await Promise.all(
        nextHeaders.map( async ({ next, peer }) =>
        {
            const client = peer.chainSync;

            if( next instanceof ChainSyncRollForward )
            {
                const header = MultiEraHeader.fromCbor( next.getDataBytes() )
                if(
                    !extensions.some( 
                        hdr => uint8ArrayEq( hdr.header.hash, header.hash )
                    )
                ) extensions.push({ header, peer });
                return;
            }
            
            // else if( next instanceof ChainSyncRollBackwards )

            const intersection = next.point;
            const peerTip = next.tip.point;
            if(!(
                isRealPoint( peerTip ) &&
                isRealPoint( intersection )
            )) throw new Error("invalid peer tip");
            
            // in theory we should stop right before receiving "msgAwaitReply"
            // if we receive it we missed the tip; and the loop would continue forever
            // we add a listener to "awaitReply" to avoid this scenario
            let unnoticedTip: boolean = false;
            const setUnnoticedTip = () => { unnoticedTip = true; };
            client.once("awaitReply", setUnnoticedTip);
            
            let forward: ChainSyncRollForward;
            let hdr: MultiEraHeader;

            const fragment: MultiEraHeader[] = [];
            
            do {
                forward = await client.requestNext() as ChainSyncRollForward;
                if( unnoticedTip ) throw new Error("unnoticed tip");
                
                if( forward instanceof ChainSyncRollBackwards )
                {
                    logger.error("unexpected sequential rollback");
                    throw new Error("unexpected sequential rollback");
                }
                
                hdr = MultiEraHeader.fromCbor( forward.getDataBytes() );

                fragment.push( hdr );
            } while(
                !eqChainPoint(
                    pointFromHeader( hdr.header ),
                    peerTip
                )
            );

            // no longer needed listener
            client.removeEventListener("awaitReply", setUnnoticedTip);

            const fork = {
                intersection,
                fragment,
                peer
            };

            if(
                !forks.some( 
                    frk => eqChainForkHeaders( frk, fork )
                )
            )
            forks.push( fork );
        })
    );

    return {
        extensions,
        forks
    };
}