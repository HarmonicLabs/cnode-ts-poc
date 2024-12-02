import { BlockFetchClient, ChainSyncClient, ChainSyncRollForward, Multiplexer } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { SharedMempool } from "@harmoniclabs/shared-cardano-mempool-ts";
import { HeaderPoolConfig, HeaderPoolWriter, HeaderPoolWriteResult } from "@harmoniclabs/shared-header-pool-ts";
import { Socket } from "net";
import { logger } from "../logger";
import { MultiEraHeader } from "../../lib/ledgerExtension/multi-era/MultiEraHeader";

/**
 * Upstream peer
 * 
 * handles chain sync (client), block fetch (client), tx submission (server)
 */
export class UpstreamPeer
{
    readonly headerPool: HeaderPoolWriter;
    readonly txMempool: SharedMempool;
    readonly chainSync: ChainSyncClient;
    readonly blockFetch: BlockFetchClient;
    
    constructor(
        public readonly mplexer: Multiplexer,
        public readonly headerPoolCfg: HeaderPoolConfig,
        private readonly _headerPoolMem: SharedArrayBuffer,
        private readonly _txMempoolMem: SharedArrayBuffer,
    )
    {
        this.headerPool = new HeaderPoolWriter( this._headerPoolMem, this.headerPoolCfg );
        this.txMempool = new SharedMempool( this._txMempoolMem );

        this.chainSync = new ChainSyncClient( mplexer );
        this.blockFetch = new BlockFetchClient( mplexer );

        this.chainSync.once("awaitReply", () =>
            logger.info(
                "reached tip on peer",
                this.chainSync.mplexer.socket.unwrap<Socket>().remoteAddress
            )
        );
        this.chainSync.on("error", err => {
            logger.error( err );
            throw err;
        });
        this.blockFetch.on("error", err => {
            logger.error( err );
            throw err;
        });
        
        this.chainSync.on("rollForward", this._handleRollForward);
        this.headerPool.on("free", this._clearQueque );
    }

    private _headerPoolFull: boolean = false;
    private _headerQueque: MultiEraHeader[] = [];

    private async _handleRollForward( msg: ChainSyncRollForward )
    {
        const hdr = MultiEraHeader.fromCbor( msg.getDataBytes() );
        await this._writeHeader( hdr );
    }

    private async _writeHeader( hdr: MultiEraHeader ): Promise<boolean>
    {
        const writeRes = await this.headerPool.write( hdr.hash, hdr.toCborBytes() );
        switch( writeRes ) {
            case HeaderPoolWriteResult.InsufficientSpace: {
                this._headerPoolFull = true;
                this._headerQueque.push( hdr );
                return false;
            }
            case HeaderPoolWriteResult.Duplicate:
            case HeaderPoolWriteResult.Invalid:
            case HeaderPoolWriteResult.Ok:
            default: 
                return true;
        }
    }

    private async _clearQueque()
    {
        if( !this._headerPoolFull ) return;
        while(
            this._headerQueque.length > 0 &&
            await this._writeHeader( this._headerQueque.shift()! )
        ) {}
        this._headerPoolFull = this._headerQueque.length > 0;
    }

}