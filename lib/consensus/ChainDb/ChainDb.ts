import { ImmutableDb } from "./ImmutableDb";
import { LedgerDb } from "./LedgerDb";
import { VolatileDb } from "./VolatileDb/VolatileDb";

export class ChainDb
{
    readonly path: string
    readonly volatileDb: VolatileDb;
    readonly immutableDb: ImmutableDb;
    readonly ledgerDb: LedgerDb;

    constructor()
    {

    }
}