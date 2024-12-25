import { Multiplexer, MiniProtocol, HandshakeClient, CardanoNetworkMagic, HandshakeAcceptVersion, HandshakeQueryReply, HandshakeRefuse } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { logger } from "./logger";
import { Socket } from "net";

export function performHandshake(
    mplexers: Multiplexer[],
    networkMagic: number = CardanoNetworkMagic.Preprod
): Promise<(HandshakeAcceptVersion | HandshakeRefuse | HandshakeQueryReply)[]>
{
    return Promise.all(
        mplexers.map( mplexer => {
            const client = new HandshakeClient( mplexer );

            logger.info(`Performing handshake`);
            client.on("accept", logger.debug)

            return client.propose({
                networkMagic,
                query: false
            })
            .then( result => {
                logger.debug("Handshake result: ", result);
                client.terminate();
                return result;
            });
        })
    );
}