import { RealPoint } from "@harmoniclabs/ouroboros-miniprotocols-ts";
import { IHeader } from "../IHeader";
import { CanBeCborString, Cbor, CborArray, CborBytes, CborObj, CborString, CborText, CborUInt, forceCborString } from "@harmoniclabs/cbor";
import { U8Arr, U8Arr28, U8Arr32 } from "../types";
import { roDescr } from "../../utils/roDescr";
import { getCborBytesDescriptor } from "../../utils/getCborBytesDescriptor";
import { blake2b_256 } from "../../crypto";


export type IByronTxProof = [ number, U8Arr32, U8Arr32 ];

export function byronTxProofToCborObj( txProof: IByronTxProof ): CborArray
{
    return new CborArray([
        new CborUInt( txProof[0] ),
        new CborBytes( txProof[1] ),
        new CborBytes( txProof[2] ),
    ]);
}

export function byronTxProofFromCborObj( cbor: CborObj ): IByronTxProof
{
    if(!(
        cbor instanceof CborArray &&
        cbor.array.length >= 3
    )) throw new Error("invalid cbor for ByronHeader::IByronBodyProof::IByronTxProof");

    const [
        cN,
        cHash1,
        cHash2
    ] = cbor.array;

    if(!(
        cN instanceof CborUInt &&
        cHash1 instanceof CborBytes &&
        cHash2 instanceof CborBytes
    )) throw new Error("invalid cbor for ByronHeader::IByronBodyProof::IByronTxProof");
    
    return [
        Number( cN.num ),
        cHash1.buffer as U8Arr32,
        cHash2.buffer as U8Arr32,
    ];
}

export type IByronSscProof 
    = [ 0, U8Arr32, U8Arr32 ]
    | [ 1, U8Arr32, U8Arr32 ]
    | [ 2, U8Arr32, U8Arr32 ]
    | [ 3, U8Arr32 ];

export function byronSscProofToCborObj( sscProof: IByronSscProof ): CborArray
{
    const fst = new CborUInt( sscProof[0] );
    const rest = sscProof.slice(1) as Uint8Array[];
    return new CborArray([
        fst,
        ...rest.map( b => new CborBytes( b ) )
    ]);
}

export function byronSscProofFromCborObj( cbor: CborObj ): IByronSscProof
{
    if(!(
        cbor instanceof CborArray &&
        cbor.array.length >= 2
    )) throw new Error("invalid cbor for ByronHeader::IByronBodyProof::IByronSscProof");

    const [
        cIdx,
        cHash1,
        cHash2
    ] = cbor.array;

    if(!(
        cIdx instanceof CborUInt &&
        cHash1 instanceof CborBytes
        // do not check cHash2 as it might be undefined
    )) throw new Error("invalid cbor for ByronHeader::IByronBodyProof::IByronSscProof");

    const idx = Number( cIdx.num );

    if(!( 0 <= idx && idx <= 3 )) throw new Error("invalid index for ByronHeader::IByronBodyProof::IByronSscProof");

    if( idx === 3 )
    {
        return [ 3, cHash1.buffer as U8Arr32 ];
    }

    if(!( cHash2 instanceof CborBytes )) throw new Error("invalid cbor for ByronHeader::IByronBodyProof::IByronSscProof");

    return [
        idx as 0 | 1 | 2 | 3,
        cHash1.buffer as U8Arr32,
        cHash2.buffer as U8Arr32
    ] as any;
}

export interface IByronBodyProof {
    txProof: IByronTxProof,
    sscProof: IByronSscProof,
    dlgProof: U8Arr32,
    updProof: U8Arr32,
}

export function byronBodyProofToCborObj( bProof: IByronBodyProof ): CborArray
{
    return new CborArray([
        byronTxProofToCborObj( bProof.txProof ),
        byronSscProofToCborObj( bProof.sscProof ),
        new CborBytes( bProof.dlgProof ),
        new CborBytes( bProof.updProof ),
    ]);
}

export function byronBodyProofFromCborObj( cbor: CborObj ): IByronBodyProof
{
    if(!(
        cbor instanceof CborArray &&
        cbor.array.length >= 4
    )) throw new Error("invalid cbor for ByronHeader::IByronBodyProof");

    const [
        cTxProof,
        cSscProof,
        cDlgProof,
        cUpdProof
    ] = cbor.array;

    if(!(
        cDlgProof instanceof CborBytes &&
        cUpdProof instanceof CborBytes
    )) throw new Error("invalid cbor for ByronHeader::IByronBodyProof");

    return {
        txProof : byronTxProofFromCborObj( cTxProof ),
        sscProof: byronSscProofFromCborObj( cSscProof ),
        dlgProof: cDlgProof.buffer as U8Arr32,
        updProof: cUpdProof.buffer as U8Arr32
    }
}

export type EpochId = bigint;

export interface IByronSlotId {
    epoch: EpochId,
    slot: bigint
}

export function byronSlotIdToCborObj( slotid: IByronSlotId ): CborArray
{
    return new CborArray([
        new CborUInt( slotid.epoch ),
        new CborUInt( slotid.slot ),
    ]);
}

export function byronSlotIdFromCborObj( cbor: CborObj ): IByronSlotId
{
    if(!(
        cbor instanceof CborArray &&
        cbor.array.length >= 2 &&
        cbor.array.every( c => c instanceof CborUInt )
    )) throw new Error("invalid cbor for IByronSlotId");

    const [ epoch, slot ] = cbor.array as CborUInt[];

    return {
        epoch: epoch.num,
        slot: slot.num
    };
}

// wtf is this name?
export interface Lwdlg {
    epochRange: [EpochId,EpochId],
    issuer: U8Arr32,
    delegate: U8Arr32,
    certificate: Uint8Array,
}

export function lwdlgToCborObj({
    epochRange,
    issuer,
    delegate,
    certificate
}: Lwdlg ): CborArray
{
    return new CborArray([
        new CborArray( epochRange.map( n => new CborUInt( n ) )),
        new CborBytes( issuer ),
        new CborBytes( delegate ),
        new CborBytes( certificate ),
    ]);
}

export function lwdlgFromCborObj( cbor: CborObj ): Lwdlg
{
    if(!(
        cbor instanceof CborArray &&
        cbor.array.length >= 4
    )) throw new Error("invalid cbor for Lwdlg");

    const [
        cEpochRange,
        cIssuer,
        cDelegate,
        cCert
    ] = cbor.array;

    if(!(
        cEpochRange instanceof CborArray &&
        cEpochRange.array.length >= 2 &&
        cEpochRange.array[0] instanceof CborUInt &&
        cEpochRange.array[1] instanceof CborUInt &&
        cIssuer instanceof CborBytes &&
        cDelegate instanceof CborBytes &&
        cCert instanceof CborBytes
    )) throw new Error("invalid cbor for Lwdlg");

    return {
        epochRange: [ cEpochRange.array[0].num, cEpochRange.array[1].num ],
        issuer: cIssuer.buffer as U8Arr32,
        delegate: cDelegate.buffer as U8Arr32,
        certificate: cCert.buffer,
    };
}

// wtf is this name?
export interface Dlg {
    epoch: EpochId,
    issuer: U8Arr32,
    delegate: U8Arr32,
    certificate: Uint8Array,
}

export function dlgToCborObj({
    epoch,
    issuer,
    delegate,
    certificate,
}: Dlg ): CborArray
{
    return new CborArray([
        new CborUInt ( epoch ),
        new CborBytes( issuer ),
        new CborBytes( delegate ),
        new CborBytes( certificate ),
    ]);
}


export function dlgFromCborObj( cbor: CborObj ): Dlg
{
    if(!(
        cbor instanceof CborArray &&
        cbor.array.length >= 4
    )) throw new Error("invalid cbor for Lwdlg");

    const [
        cEpoch,
        cIssuer,
        cDelegate,
        cCert
    ] = cbor.array;

    if(!(
        cEpoch instanceof CborUInt &&
        cIssuer instanceof CborBytes &&
        cDelegate instanceof CborBytes &&
        cCert instanceof CborBytes
    )) throw new Error("invalid cbor for Lwdlg");

    return {
        epoch: cEpoch.num,
        issuer: cIssuer.buffer as U8Arr32,
        delegate: cDelegate.buffer as U8Arr32,
        certificate: cCert.buffer,
    };
}

export type LwdlgSig = [ Lwdlg, Uint8Array ];
export type DlgSig = [ Dlg, Uint8Array ];

export type IByronBlockSig 
    = [ 0, Uint8Array ]
    | [ 1, LwdlgSig ]
    | [ 2, DlgSig ]

export function byronBlockSigToCborObj( bSig: IByronBlockSig ): CborArray
{
    switch( bSig[0] )
    {
        case 0: {
            return new CborArray([
                new CborUInt( 0 ),
                new CborBytes( bSig[1] )
            ]);
            break;
        }
        case 1: {
            return new CborArray([
                new CborUInt( 1 ),
                new CborArray([
                    lwdlgToCborObj( bSig[1][0] ),
                    new CborBytes( bSig[1][1] )
                ])
            ]);
            break;
        }
        case 2: {
            return new CborArray([
                new CborUInt( 2 ),
                new CborArray([
                    dlgToCborObj( bSig[1][0] ),
                    new CborBytes( bSig[1][1] )
                ])
            ])
            break;
        }
        default: throw new Error("unrecognized 'IByronBlockSig'")
    }
}

export function byronBlockSigFromCborObj( cbor: CborObj ): IByronBlockSig
{
    if(!(
        cbor instanceof CborArray &&
        cbor.array.length >= 2 &&
        cbor.array[0] instanceof CborUInt
    )) throw new Error("invald cbor for IByronBlockSig");

    const idx = Number( cbor.array[0].num );
    const other = cbor.array[1];

    switch( idx )
    {
        case 0: {
            if(!( other instanceof CborBytes )) throw new Error("invald cbor for IByronBlockSig");
            return [ 0, other.buffer ];
            break;
        }
        case 1:
        case 2: {
            if(!(
                other instanceof CborArray &&
                other.array.length >= 2 &&
                other.array[1] instanceof CborBytes
            )) throw new Error("invald cbor for IByronBlockSig");
            break;
        }
        default: throw new Error("unrecognized 'IByronBlockSig' index from cbor")
    }

    const sigCbor = other.array[0];
    const hash = other.array[1].buffer;

    const sig = idx === 1 ? lwdlgFromCborObj( sigCbor ) : dlgFromCborObj( sigCbor );
    
    return [
        idx,
        sig,
        hash
    ] as any;
}

export interface IByronConsData {
    slotid: IByronSlotId,
    pubkey: U8Arr32, // pubkey is32; pub key hash is 28
    diff: bigint,
    blockSig: IByronBlockSig,
}

export function byronConsDataToCborObj( consData: IByronConsData ): CborArray
{
    return new CborArray([
        byronSlotIdToCborObj( consData.slotid ),
        new CborBytes( consData.pubkey ),
        new CborArray([ new CborUInt( consData.diff ) ]),
        byronBlockSigToCborObj( consData.blockSig )
    ])
}

export function byronConsDataFromCborObj( cbor: CborObj ): IByronConsData
{
    if(!(
        cbor instanceof CborArray &&
        cbor.array.length >= 4
    )) throw new Error("invalid cbor for ByronHeader::IByronConsData");

    const [
        cSlotid,
        cPubkey,
        cDiff,
        cBlockSig
    ] = cbor.array;

    if(!(
        cPubkey instanceof CborBytes &&
        cDiff instanceof CborArray &&
        cDiff.array.length === 1 &&
        cDiff.array[0] instanceof CborUInt
    )) throw new Error("invalid cbor for ByronHeader::IByronConsData");

    const slotid = byronSlotIdFromCborObj( cSlotid );
    const blockSig = byronBlockSigFromCborObj( cBlockSig );

    return {
        slotid,
        pubkey: cPubkey.buffer as U8Arr32,
        diff: cDiff.array[0].num,
        blockSig
    };
}

export interface IByronHeaderExtra {
    version: [ number, number, number ],
    softwareVersion: [ string, number ],
    attrs: CborObj,
    extraProof: U8Arr32
}

export function byronHeaderExtraToCborObj({
    version,
    softwareVersion,
    attrs,
    extraProof
}: IByronHeaderExtra ): CborArray
{
    return new CborArray([
        new CborArray( version.map( n => new CborUInt( n ) )),
        new CborArray([
            new CborText( softwareVersion[0] ),
            new CborUInt( softwareVersion[1] ),
        ]),
        attrs,
        new CborBytes( extraProof )
    ]);
}

export function byronHeaderExtraFromCborObj( cbor: CborObj ): IByronHeaderExtra
{
    if(!(
        cbor instanceof CborArray &&
        cbor.array.length >= 4
    )) throw new Error("invalid cbor for IByronHeaderExtra");

    const [
        cVer,
        cSoftVer,
        attrs,
        cExtraProof
    ] = cbor.array;

    if(!(
        cVer instanceof CborArray &&
        cSoftVer instanceof CborArray &&
        cVer.array.length >= 3 &&
        cVer.array.every( c => c instanceof CborUInt ) &&
        cSoftVer.array.length >= 2 &&
        cSoftVer.array[0] instanceof CborText &&
        cSoftVer.array[1] instanceof CborUInt &&
        cExtraProof instanceof CborBytes
    ))  throw new Error("invalid cbor for IByronHeaderExtra");

    const verArr = cVer.array as CborUInt[];

    return {
        version: [
            Number( verArr[0] ),
            Number( verArr[1] ),
            Number( verArr[2] ),
        ],
        softwareVersion: [
            cSoftVer.array[0].text,
            Number( cSoftVer.array[1].num )
        ],
        attrs,
        extraProof: cExtraProof.buffer as U8Arr32
    }
}

export interface IByronHeader
    extends IHeader
{
    readonly protocolMagic: number;
    readonly bodyProof: IByronBodyProof
    readonly consensusData: IByronConsData
    readonly extra: IByronHeaderExtra
}

export class ByronHeader
    implements IByronHeader
{
    readonly hash: Uint8Array & { readonly length: 32; };
    readonly prevHash: Uint8Array & { readonly length: 32; };
    readonly slotNo: bigint;
    readonly isEBB: false;
    
    readonly protocolMagic: number;
    readonly bodyProof: IByronBodyProof;
    readonly consensusData: IByronConsData;
    readonly extra: IByronHeaderExtra;

    readonly cborBytes?: Uint8Array;

    constructor( header: IByronHeader )
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
            byronBodyProofToCborObj( this.bodyProof ),
            byronConsDataToCborObj( this.consensusData ),
            byronHeaderExtraToCborObj( this.extra )
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

    static fromCbor( cbor: CanBeCborString ): ByronHeader
    {
        const bytes = cbor instanceof Uint8Array ? cbor : forceCborString( cbor ).toBuffer();
        return ByronHeader.fromCborObj( Cbor.parse( bytes ), bytes );
    }
    static fromCborObj( cbor: CborObj, _originalBytes?: Uint8Array ): ByronHeader
    {
        if(!(
            cbor instanceof CborArray &&
            cbor.array.length >= 5
        )) throw new Error("invalid cbor fot ByronHeader");

        const [
            cborMagic,
            cborPrevHash,
            cborBodyProof,
            cborConsData,
            cborExtra
        ] = cbor.array;

        if(!(
            cborMagic instanceof CborUInt &&
            cborPrevHash instanceof CborBytes
        )) throw new Error("invalid cbor fot ByronHeader");

        const bodyProof = byronBodyProofFromCborObj( cborBodyProof );
        const consensusData = byronConsDataFromCborObj( cborConsData );
        const extra = byronHeaderExtraFromCborObj( cborExtra );

        const originalWerePresent = _originalBytes instanceof Uint8Array;
        _originalBytes = _originalBytes instanceof Uint8Array ? _originalBytes : Cbor.encode( cbor ).toBuffer();
        
        const hdr = new ByronHeader({
            // byron is a pain
            // the hash is calculated wrapping the header in the second slot of an array
            // the first slot is uint(0) for EBB and uint(1) for normal byron blocks
            hash: blake2b_256( new Uint8Array([ 0x82, 0x01, ..._originalBytes ]) ) as U8Arr32,
            prevHash: cborPrevHash.buffer as U8Arr32,
            slotNo: consensusData.slotid.epoch * BigInt( 21600 ) + consensusData.slotid.slot,
            isEBB: false,
            protocolMagic: Number( cborMagic.num ),
            bodyProof,
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