import { existsSync, readFileSync } from "fs";
import { Topology, adaptLegacyTopology, isLegacyTopology, isTopology } from "../lib/topology";

export function parseTopology( path: string ): Topology
{
    if( !existsSync( path ) ) throw new Error("missing topology file at " + path );

    let topology = JSON.parse( readFileSync( path, { encoding: "utf8" }) );

    topology = isLegacyTopology( topology ) ? adaptLegacyTopology( topology ) : topology;

    if( !isTopology( topology ) ) throw new Error("invalid topology file at " + path);
    
    return topology;
}