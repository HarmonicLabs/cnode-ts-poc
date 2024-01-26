import { ChainPoint } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { logger } from "../../src/logger";
import { ChainDb } from "./ChainDb/ChainDb";
import { IHeader } from "../ledgerExtension/IHeader";
import { toHex } from "@harmoniclabs/uint8array-utils";

/** @todo */
export function initialChaiSel() {}

/**
 * 
 * @param headerBlockNo 
 * @param isEBB 
 * @param latestImmutableBlockNo 
 * @returns {boolean} `true` when the header used to get `headerBlockNo` should be ignored
 * because it is too old, i.e., we wouldn't be able to swithch to a chain containing the
 * corresponding block because its block number is more than `k` block or exactly `k`
 * blocks back
 * 
 * Special case: the header corresponds to an EBB which has the same
 * block number as the block `k` blocks back (the most recent immutable block).
 * AsEBBs shyare their block number with the block before them the EBB is not
 * too old in that case and can be adopted as part of our chain 
 */
export function isOlderThanK(
    headerBlockNo: number,
    isEBB: boolean,
    latestImmutableBlockNo: number | "origin"
): boolean
{
    // latest is origin => not older than k
    if(!( typeof latestImmutableBlockNo === "number" )) return false;
    if( isEBB ) return latestImmutableBlockNo == headerBlockNo;

    return headerBlockNo <= latestImmutableBlockNo
}

/**
 * 
 * @returns {ChainPoint} the new tip
 */
export function chainSelectionForFutureBlocks(
    chainDb: any,
    blockCache: any
): ChainPoint
{

}


export async function chainSelectionForBlock(
    chainDb: ChainDb,
    header: IHeader,
    onInvalid: () => void
): ChainPoint
{
    const k = chainDb.getTopLevelConfig().securityParam;

    const volatileDb = chainDb.volatileDb;
    const successorOf = volatileDb.filterByPredecessor();
    const tipPoint = volatileDb.tipPoint;
    const currChain = volatileDb.getCurrChain();
    const ledgerDb = chainDb.ledgerDb;

    if(!( currChain.length <= k)) throw new Error("currCahin longer than k");

    // PRECONDITION: block must be in volatileDb
    if(!( await volatileDb.getBlockInfos( header.hash ) )) throw new Error("block was not in volatileDb");

    // block older than k; won't switch anyway
    if( isOlderThanK( header.blockNo, header.isEBB, currChain.anchorBlockNo ) )
    {
        logger.warn("ingoring block older than k");
        return tipPoint;
    }
    // block invalid
    else if( volatileDb.invalidBlocks.has( toHex(header.hash) ) )
    {
        logger.warn("ingnoring invalid block");
        onInvalid();
        return tipPoint;
    }
    // block fits at the end of the chain (chain extended)
    else if( tipPoint.blockHeader.hash === header.prevHash )
    {
        await addToCurrentChain( successorOf, currChain, ledgerDb )
        logger.info("chain extended");
    }
    // 
    else if( volatileDb.canSwitchTo )
    {
    }
    // nowhere to use the block
    // store (might turn useful in future)
    // but do not change the chain
    else
    {

    }

}

async function addToCurrentChain(
    successorOf: ( block: any ) => any,
    currChain: ChainPoint,
    ledgerDb: any
): Promise<void>
{
    
}