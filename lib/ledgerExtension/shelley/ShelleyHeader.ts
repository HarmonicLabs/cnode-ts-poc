import { CanBeCborString, Cbor, CborArray, CborBytes, CborObj, CborString, CborUInt, forceCborString } from "@harmoniclabs/cbor";
import { IHeader } from "../IHeader";
import { U8Arr, U8Arr32 } from "../types";
import { blake2b_256 } from "../../crypto";
import { byronBodyProofFromCborObj, byronConsDataFromCborObj, byronHeaderExtraFromCborObj } from "../byron/ByronHeader";

export type VrfCert = [
    Uint8Array,
    U8Arr<80>
];

export function vrfCertToCborObj( vrfCert: VrfCert ): CborArray
{
    return new CborArray([
        new CborBytes( vrfCert[0] ),
        new CborBytes( vrfCert[1] ),
    ]);
}

export function vrfCertFromCborObj( vrfCert: CborObj ): VrfCert
{
    if(!(
        vrfCert instanceof CborArray &&
        vrfCert.array.length >= 2 &&
        vrfCert.array[0] instanceof CborBytes &&
        vrfCert.array[1] instanceof CborBytes &&
        vrfCert.array[1].buffer.length === 80
    )) throw new Error("invalid cbor for 'VrfCert'");

    return [
        vrfCert.array[0].buffer,
        vrfCert.array[1].buffer as U8Arr<80>,
    ];
}

export interface IOperationalCert {
    hotVkey: U8Arr32,
    sequenceNumber: bigint,
    kesPeriod: bigint,
    signature: U8Arr<64>
}

export function opCertToCborObjElems({
    hotVkey,
    sequenceNumber,
    kesPeriod,
    signature
}: IOperationalCert ): CborObj[]
{
    return [
        new CborBytes( hotVkey ),
        new CborUInt( sequenceNumber ),
        new CborUInt( kesPeriod ),
        new CborBytes( signature ),
    ];
}

export interface IProtocolVersion {
    major: number,
    minor: number
}

export interface IShelleyHeader extends IHeader {
    readonly blockNo: bigint,
    // readonly slotNo: bigint // part of IHeader
    // readonly prevHash: U8Arr32 // part of IHeader,
    readonly issuerVkey: U8Arr32,
    readonly vrfVkey: U8Arr32,
    readonly nonceVrf: VrfCert,
    readonly leaderVrf: VrfCert,
    readonly blockBodySize: bigint,
    readonly blockBodyHash: U8Arr32,
    readonly operationalCert: IOperationalCert,
    readonly protocolVersion: IProtocolVersion,
    readonly bodySignature: Uint8Array;
}

export class ShelleyHeader
    implements IShelleyHeader
{
    readonly hash: Uint8Array & { readonly length: 32; };
    readonly prevHash: Uint8Array & { readonly length: 32; };
    readonly slotNo: bigint;
    readonly isEBB: boolean;

    readonly blockNo: bigint;
    readonly issuerVkey: U8Arr32;
    readonly vrfVkey: U8Arr32;
    readonly nonceVrf: VrfCert;
    readonly leaderVrf: VrfCert;
    readonly blockBodySize: bigint;
    readonly blockBodyHash: U8Arr32;
    readonly operationalCert: IOperationalCert;
    readonly protocolVersion: IProtocolVersion;

    readonly bodySignature: Uint8Array;

    readonly cborBytes?: Uint8Array | undefined;

    constructor( header: IShelleyHeader )
    {

    }


    toCbor(): CborString
    {
        return new CborString( this.toCborBytes() );
    }
    toCborObj(): CborArray
    {
        return new CborArray([
            new CborArray([ // header_body
                new CborUInt(  this.blockNo ),
                new CborUInt(  this.slotNo ),
                new CborBytes( this.prevHash ),
                new CborBytes( this.issuerVkey ),
                new CborBytes( this.vrfVkey ),
                vrfCertToCborObj( this.nonceVrf ),
                vrfCertToCborObj( this.leaderVrf ),
                new CborUInt(  this.blockBodySize ),
                new CborBytes( this.blockBodyHash ),
                ...opCertToCborObjElems( this.operationalCert ),
                new CborUInt( this.protocolVersion.major ),
                new CborUInt( this.protocolVersion.minor ),
            ]),
            new CborBytes( this.bodySignature )
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

    static fromCbor( cbor: CanBeCborString ): ShelleyHeader
    {
        const bytes = cbor instanceof Uint8Array ? cbor : forceCborString( cbor ).toBuffer();
        return ShelleyHeader.fromCborObj( Cbor.parse( bytes ), bytes );
    }
    static fromCborObj( cbor: CborObj, _originalBytes?: Uint8Array ): ShelleyHeader
    {
        if(!(
            cbor instanceof CborArray &&
            cbor.array.length >= 2
        )) throw new Error("invalid cbor fot ShelleyHeader");

        const [
            cHdrBody,
            cBodySignature
        ] = cbor.array;

        if(!(
            cHdrBody instanceof CborArray &&
            cHdrBody.array.length >= 15 &&
            cBodySignature instanceof CborBytes
        )) throw new Error("invalid cbor for ShelleyHeader");

        const [
            cBlockNo,
            cSlotNo,
            cPrevHash,
            cIssuerVkey,
            cVrfVkey,
            cNonceVrf,
            cLeaderVrf,
            cBlockBodySize,
            cBlockBodyHash,
            cHotVkey,
            cSequenceNumber,
            cKesPeriod,
            cSignature,
            cProtVerMajor,
            cProtVerMinor
        ] = cHdrBody.array;

        if(!(
            cBlockNo instanceof CborUInt        &&
            cSlotNo  instanceof CborUInt        &&
            cPrevHash   instanceof CborBytes    &&
            cIssuerVkey instanceof CborBytes    &&
            cVrfVkey    instanceof CborBytes    &&
            cBlockBodySize instanceof CborUInt  &&
            cBlockBodyHash instanceof CborBytes &&
            cHotVkey instanceof CborBytes       &&
            cSequenceNumber instanceof CborUInt &&
            cKesPeriod instanceof CborUInt      &&
            cSignature instanceof CborBytes     &&
            cProtVerMajor instanceof CborUInt   &&
            cProtVerMinor instanceof CborUInt
        )) throw new Error("invalid cbor for ShelleyHeader");

        const nonceVrf = vrfCertFromCborObj( cNonceVrf );
        const leaderVrf = vrfCertFromCborObj( cLeaderVrf );

        const originalWerePresent = _originalBytes instanceof Uint8Array;
        _originalBytes = _originalBytes instanceof Uint8Array ? _originalBytes : Cbor.encode( cbor ).toBuffer();
        
        const hdr = new ShelleyHeader({
            hash: blake2b_256( _originalBytes ) as U8Arr32,
            prevHash: cPrevHash.buffer as U8Arr32,
            slotNo: cSlotNo.num,
            isEBB: false,
            blockNo: cBlockNo.num,
            issuerVkey: cIssuerVkey.buffer as U8Arr32,
            vrfVkey: cVrfVkey.buffer as U8Arr32,
            nonceVrf,
            leaderVrf,
            blockBodySize: cBlockBodySize.num,
            blockBodyHash: cBlockBodyHash.buffer as U8Arr32,
            operationalCert: {
                hotVkey: cHotVkey.buffer as U8Arr32,
                sequenceNumber: cSequenceNumber.num,
                kesPeriod: cKesPeriod.num,
                signature: cSignature.buffer as U8Arr<64>,
            },
            protocolVersion: {
                major: Number( cProtVerMajor.num ),
                minor: Number( cProtVerMinor.num )
            },
            bodySignature: cBodySignature.buffer,
        });

        if( originalWerePresent )
        {
            // @ts-ignore Cannot assign to 'cborBytes' because it is a read-only property.
            hdr.cborBytes = _originalBytes;
        }

        return hdr;
    }
}