import { Socket, connect } from "net";
import { parseTopology } from "./parseTopology";
import { MiniProtocol, Multiplexer, N2NHandshakeVersion, N2NMessageAcceptVersion, N2NMessageProposeVersion, n2nHandshakeMessageFromCbor } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { logger } from "./logger";
import { performHandshake } from "./performHandshake";
import { runNode } from "./runNode";

void async function main()
{
    const topology = parseTopology("./topology.json");
    const networkMagic = 1; // preprod
    const mplexers: Multiplexer[] = 
        topology.localRoots.concat( topology.publicRoots )
        .map( root =>
            root.accessPoints.map( accessPoint => {
                const mplexer = new Multiplexer({
                    connect: () => 
                        connect({
                            host: accessPoint.address,
                            port: accessPoint.port
                        }),
                    protocolType: "node-to-node"
                });
                return mplexer;
            })
        )
        .flat( 1 );

    void await performHandshake( mplexers, networkMagic );
    void await runNode( mplexers, 10 );
}();
