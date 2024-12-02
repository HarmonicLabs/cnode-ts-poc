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
    
    void await runNode({
        topology,
        networkMagic
    });
}();
