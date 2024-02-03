import { existsSync, mkdirSync } from "fs";
import { roDescr } from "../../utils/roDescr";
import { ChainDb } from "./ChainDb";

export class ImmutableDb
{
    readonly path: string;
    readonly chainDb: ChainDb;
    chunks: number;

    constructor( fullPath: string, chainDb: ChainDb )
    {
        createDbDirs( fullPath );
        let _chunks = 0;
        Object.defineProperties(
            this, {
                path: { value: fullPath.toString(), ...roDescr },
                chainDb: { value: chainDb, ...roDescr },
                chunks: {
                    get: () => _chunks,
                    set: ( next: number ) => {
                        if( typeof next === "number" && Number.isSafeInteger( next ) )
                        {
                            _chunks = next;
                        }
                        return next;
                    },
                    enumerable: true,
                    configurable: false
                }
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
}