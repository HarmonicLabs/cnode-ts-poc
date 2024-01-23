import { CanBeCborString, Cbor, CborArray, CborBytes, CborObj, CborString, CborUInt, forceCborString } from "@harmoniclabs/cbor";
import { IHeader } from "../IHeader";
import { U8Arr28, U8Arr32 } from "../types";
import { IRealPoint } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { getCborBytesDescriptor } from "../../utils/getCborBytesDescriptor";
import { roDescr } from "../../utils/roDescr";
import { blake2b_256 } from "../../crypto";
import { type EpochId } from "./ByronHeader";

export interface IByronEbbConsData {
    epochId: EpochId,
    diff: bigint
}

export function byronEbbConsDataToCborObj({ epochId, diff }: IByronEbbConsData ): CborArray
{
    return new CborArray([
        new CborUInt( epochId ),
        new CborUInt( diff ),
    ]);
}

export function byronEbbConsDataFromCborObj( cbor: CborObj ): IByronEbbConsData
{
    if(!(
        cbor instanceof CborArray &&
        cbor.array.length >= 2 &&
        cbor.array[0] instanceof CborUInt &&
        cbor.array[1] instanceof CborUInt
    )) throw new Error("invalid cbor for IByronEbbConsData");

    return {
        epochId: cbor.array[0].num,
        diff: cbor.array[1].num,
    };
}

export interface IByronEbbHeader extends IHeader {
    protocolMagic: number,
    // prevHash
    bodyProof: U8Arr32,
    consensusData: IByronEbbConsData,
    extra: CborArray
}

export class ByronEbbHeader
    implements IByronEbbHeader
{
    readonly hash: Uint8Array & { readonly length: 32; };
    readonly prevHash: Uint8Array & { readonly length: 32; };
    readonly slotNo: bigint;
    readonly isEBB: boolean;
    readonly protocolMagic: number;
    readonly bodyProof: U8Arr32;
    readonly consensusData: IByronEbbConsData;
    readonly extra: CborArray;

    readonly cborBytes?: Uint8Array;
    
    constructor( header: IByronEbbHeader )
    {
        const hash = Uint8Array.prototype.slice.call( header.hash, 0, 32 );
        Object.defineProperties(
            this, {
                hash: {
                    get: () => Uint8Array.prototype.slice.call( hash ),
                    set: (arg) => arg,
                    enumerable: true,
                    configurable: false  
                },
                prevHash: { value: header.prevHash, ...roDescr },
                slotNo: { value: header.slotNo, ...roDescr },
                isEBB: { value: header.isEBB, ...roDescr },
                protocolMagic: { value: header.protocolMagic, ...roDescr },
                bodyProof: { value: header.bodyProof, ...roDescr },
                consensusData: { value: header.consensusData, ...roDescr },
                extra: { value: header.extra, ...roDescr },
                cborBytes: getCborBytesDescriptor(),
            }
        );
    }


    toCbor(): CborString
    {
        return new CborString( this.toCborBytes() );
    }
    toCborObj(): CborArray
    {
        return new CborArray([
            new CborUInt( this.protocolMagic ),
            new CborBytes( this.prevHash ),
            new CborBytes( this.bodyProof ),
            byronEbbConsDataToCborObj( this.consensusData ),
            this.extra
        ]);
    }
    toCborBytes(): Uint8Array
    {
        if(!( this.cborBytes instanceof Uint8Array ))
        {
            // @ts-ignore Cannot assign to 'cborBytes' because it is a read-only property.
            this.cborBytes = Cbor.encode( this.toCborObj() ).toBuffer();
        }

        return Uint8Array.prototype.slice.call( this.cborBytes );
    }

    static fromCbor( cbor: CanBeCborString ): ByronEbbHeader
    {
        const bytes = cbor instanceof Uint8Array ? cbor : forceCborString( cbor ).toBuffer();
        return ByronEbbHeader.fromCborObj( Cbor.parse( bytes ), bytes );
    }
    static fromCborObj( cbor: CborObj, _originalBytes?: Uint8Array | undefined ): ByronEbbHeader
    {
        if(!(
            cbor instanceof CborArray &&
            cbor.array.length >= 5
        )) throw new Error("invalid cbor fot ByronEbbHeader");

        const [
            cborMagic,
            cborPrevHash,
            cborBodyProof,
            cborConsData,
            extra
        ] = cbor.array;

        if(!(
            cborMagic instanceof CborUInt &&
            cborPrevHash instanceof CborBytes &&
            cborBodyProof instanceof CborBytes &&
            extra instanceof CborArray
        )) throw new Error("invalid cbor fot ByronEbbHeader");

        const consensusData = byronEbbConsDataFromCborObj( cborConsData );

        const originalWerePresent = _originalBytes instanceof Uint8Array; 
        _originalBytes = _originalBytes instanceof Uint8Array ? _originalBytes : Cbor.encode( cbor ).toBuffer();

        const hdr = new ByronEbbHeader({
            // byron is a pain
            // the hash is calculated wrapping the header in the second slot of an array
            // the first slot is uint(0) for EBB and uint(1) for normal byron blocks
            hash: blake2b_256( new Uint8Array([ 0x82, 0x01, ..._originalBytes ]) ) as U8Arr32,
            prevHash: cborPrevHash.buffer as U8Arr32,
            slotNo: consensusData.epochId * BigInt( 21600 ),
            isEBB: false,
            protocolMagic: Number( cborMagic.num ),
            bodyProof: cborBodyProof.buffer as U8Arr32,
            consensusData,
            extra
        });

        if( originalWerePresent )
        {
            // @ts-ignore Cannot assign to 'cborBytes' because it is a read-only property.
            hdr.cborBytes = _originalBytes;
        }

        return hdr;
    }
}