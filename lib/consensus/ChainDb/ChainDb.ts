import { existsSync, mkdirSync } from "fs";
import { roDescr } from "../../utils/roDescr";
import { ImmutableDb } from "./ImmutableDb";
import { LedgerDb } from "./LedgerDb";
import { VolatileDb } from "./VolatileDb/VolatileDb";

export class ChainDb
{
    readonly path: string
    readonly volatileDb: VolatileDb;
    readonly immutableDb: ImmutableDb;
    readonly ledgerDb: LedgerDb;

    constructor( path: string )
    {
        path = String( path );
        createDbDirs( path );
        
        Object.defineProperties(
            this, {
                path: { value: path, ...roDescr },
                volatileDb: { value: new VolatileDb(`${path}/volatile`, this ), ...roDescr },
                immutableDb: { value: new ImmutableDb(`${path}/immutable`, this ), ...roDescr },
                ledgerDb: { value: new LedgerDb(`${path}/ledger`, this ), ...roDescr }
            }
        );
    }
}

function createDbDirs( basePath: string ): void
{
    if( !existsSync( basePath ) )
    {
        mkdirSync( basePath );
    }
    if( !existsSync( basePath + "/volatile" ) )
    {
        mkdirSync( basePath + "/volatile" );
    }
    if( !existsSync( basePath + "/immutable" ) )
    {
        mkdirSync( basePath + "/immutable" );
    }
    if( !existsSync( basePath + "/ledger" ) )
    {
        mkdirSync( basePath + "/ledger" );
    }
}