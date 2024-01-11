import { BlockFetchClient, ChainSyncClient, Multiplexer } from "@harmoniclabs/ouroboros-miniprotocols-ts";

export async function runNode( connections: Multiplexer[] ): Promise<void>
{
    const chainSyncClients = connections.map( mplexer => new ChainSyncClient( mplexer ) );
    const blockFetchClients = connections.map( mplexer => new BlockFetchClient( mplexer ) );

    
}