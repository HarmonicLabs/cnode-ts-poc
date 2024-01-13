import { Multiplexer, MiniProtocol, n2nHandshakeMessageFromCbor, N2NMessageAcceptVersion, N2NMessageProposeVersion, N2NHandshakeVersion } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { Socket } from "net";
import { logger } from "./logger";

export function performHandshake( mplexers: Multiplexer[], networkMagic: number ): Promise<void[]>
{
    return Promise.all(
        mplexers.map( mplexer =>
            // handshake
            new Promise<void>(( resolve => {
                mplexer.on( MiniProtocol.Handshake, chunk => {
    
                    const msg = n2nHandshakeMessageFromCbor( chunk );
    
                    if( msg instanceof N2NMessageAcceptVersion )
                    {
                        mplexer.clearListeners( MiniProtocol.Handshake );
                        logger.info("connected to node", (mplexer.socket.unwrap() as Socket).remoteAddress );
                        resolve();
                    }
                    else {
                        logger.error("connection refused", msg );
                        mplexers.splice( mplexers.indexOf( mplexer ), 1 )
                        throw new Error("TODO: handle rejection");
                        resolve();
                    }
                });
    
                mplexer.send(
                    new N2NMessageProposeVersion({
                        versionTable: [
                            {
                                version: N2NHandshakeVersion.v10,
                                data: {
                                    networkMagic,
                                    initiatorAndResponderDiffusionMode: false,
                                    peerSharing: 0,
                                    query: false
                                }
                            }
                        ]
                    }).toCbor().toBuffer(),
                    {
                        hasAgency: true,
                        protocol: MiniProtocol.Handshake
                    }
                );
            }))
        )
    );
}