import { hasOwn, isObject } from "@harmoniclabs/obj-utils"

export interface TopologyAccessPoint {
    address: string,
    port: number
}

export interface TopologyRoot {
    accessPoints: TopologyAccessPoint[],
    advertise: boolean,
    valency?: number
}

export interface Topology {
    localRoots: TopologyRoot[],
    publicRoots: TopologyRoot[],
    useLedgerAfterSlot: number
}

export interface LegacyAccessPoint {
    addr: string,
    port: number,
    valency: number
}

export interface LegacyTopology {
    Producers: LegacyAccessPoint[]
}

export function isTopology( stuff: any ): stuff is Topology
{
    if( !isObject( stuff ) ) return false;
    if( isLegacyTopology( stuff ) ) return false;

    return (
        hasOwn( stuff, "localRoots" ) &&
        Array.isArray( stuff.localRoots ) &&
        stuff.localRoots.every( isTopologyRoot ) &&

        hasOwn( stuff, "publicRoots" ) &&
        Array.isArray( stuff.publicRoots ) &&
        stuff.publicRoots.every( isTopologyRoot ) &&

        hasOwn( stuff, "useLedgerAfterSlot" ) &&
        Number.isSafeInteger( stuff.useLedgerAfterSlot ) && stuff.useLedgerAfterSlot >= 0
    );
}

export function isTopologyRoot( stuff: any ): stuff is TopologyRoot
{
    if( !isObject( stuff ) ) return false;

    return (
        hasOwn( stuff, "accessPoints" ) &&
        Array.isArray( stuff.accessPoints ) &&
        stuff.accessPoints.every( isTopologyAccessPoint ) &&

        hasOwn( stuff, "advertise" ) &&
        typeof stuff.advertise === "boolean" &&

        (
            typeof stuff.valency === "undefined" ||
            ( Number.isSafeInteger( stuff.valency ) && stuff.valency >= 0 )
        )
    );
}

export function isTopologyAccessPoint( stuff: any ): stuff is TopologyAccessPoint
{
    if( !isObject( stuff ) ) return false;

    return (
        hasOwn( stuff, "address" ) &&
        typeof stuff.address === "string" &&

        hasOwn( stuff, "port" ) &&
        typeof stuff.port === "number"
    );
}

export function isLegacyTopology( stuff: any ): stuff is LegacyTopology
{
    if( !isObject( stuff ) ) return false;

    return hasOwn( stuff, "Producers" ) && Array.isArray( stuff.Producers ) && stuff.Producers.every( isLegacyAccessPoint );
}

export function isLegacyAccessPoint( stuff: any ): stuff is LegacyAccessPoint
{
    if( !isObject( stuff ) ) return false;

    return (
        hasOwn( stuff, "addr" ) &&
        typeof stuff.addr === "string" &&

        hasOwn( stuff, "port" ) &&
        typeof stuff.port === "number" &&

        hasOwn( stuff, "valency" ) &&
        typeof stuff.valency === "number" &&
        stuff.valency >= 0
    );
}

export function adaptLegacyTopology( legacy: LegacyTopology ): Topology
{
    const topology : Topology = {
        localRoots: legacy.Producers.map( legacyAccessPointToTopologyRoot ),
        publicRoots: [],
        useLedgerAfterSlot: 0
    };

    return topology;
}

export function legacyAccessPointToTopologyRoot( ap: LegacyAccessPoint ): TopologyRoot
{
    return {
        accessPoints: [
            {
                address: ap.addr,
                port: ap.port
            }
        ],
        advertise: false,
        valency: ap.valency
    };
}