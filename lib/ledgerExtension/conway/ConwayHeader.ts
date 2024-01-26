import { CanBeCborString, Cbor, CborArray, CborBytes, CborObj, CborString, CborUInt, forceCborString } from "@harmoniclabs/cbor";
import { U8Arr, U8Arr32 } from "../types";
import { blake2b_256 } from "../../crypto";
import { IOperationalCert, opCertFromCborObj, opCertToCborObj, opCertToCborObjElems } from "../common/operationalCert";
import { IShelleyHeader } from "../shelley";
import { VrfCert, vrfCertFromCborObj, vrfCertToCborObj } from "../common/vrfCert";
import { getCborBytesDescriptor } from "../../utils/getCborBytesDescriptor";
import { roDescr } from "../../utils/roDescr";
import { IHeader } from "../IHeader";
import { IProtocolVersion, protocolVersionFromCborObj, protocolVersionToCborObj } from "../common/protocolVersion";
import { IBabbageHeader } from "../babbage/BabbageHeader";

export interface IConwayHeader extends IBabbageHeader {}

export class ConwayHeader
    implements IConwayHeader
{
    readonly hash: Uint8Array & { readonly length: 32; };
    readonly prevHash: Uint8Array & { readonly length: 32; };
    readonly slotNo: bigint;
    readonly isEBB: boolean;
    readonly cborBytes?: Uint8Array | undefined;

    readonly blockNo: bigint;
    readonly issuerVkey: U8Arr32;
    readonly vrfVkey: U8Arr32;
    readonly blockBodySize: bigint;
    readonly blockBodyHash: U8Arr32;
    readonly operationalCert: IOperationalCert;
    readonly protocolVersion: IProtocolVersion;
    
    readonly bodySignature: Uint8Array;

    // must be at the bottom to preserve object shape with other eras headers
    readonly vrfResult: VrfCert;

    constructor( header: IConwayHeader )
    {
        Object.defineProperties(
            this, {
                hash: { value: header.hash, ...roDescr },
                prevHash: { value: header.prevHash, ...roDescr },
                slotNo: { value: header.slotNo, ...roDescr },
                isEBB: { value: header.isEBB, ...roDescr },
                cborBytes: getCborBytesDescriptor(),
                blockNo: { value: header.blockNo, ...roDescr },
                issuerVkey: { value: header.issuerVkey, ...roDescr },
                vrfVkey: { value: header.vrfVkey, ...roDescr },
                blockBodySize: { value: header.blockBodySize, ...roDescr },
                blockBodyHash: { value: header.blockBodyHash, ...roDescr },
                operationalCert: { value: header.operationalCert, ...roDescr },
                protocolVersion: { value: header.protocolVersion, ...roDescr },
                bodySignature: { value: header.bodySignature, ...roDescr },
                vrfResult: { value: header.vrfResult, ...roDescr },
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
            new CborArray([ // header_body
                new CborUInt(  this.blockNo ),
                new CborUInt(  this.slotNo ),
                new CborBytes( this.prevHash ),
                new CborBytes( this.issuerVkey ),
                new CborBytes( this.vrfVkey ),
                vrfCertToCborObj( this.vrfResult ),
                new CborUInt(  this.blockBodySize ),
                new CborBytes( this.blockBodyHash ),
                opCertToCborObj( this.operationalCert ),
                protocolVersionToCborObj( this.protocolVersion )
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

    static fromCbor( cbor: CanBeCborString ): ConwayHeader
    {
        const bytes = cbor instanceof Uint8Array ? cbor : forceCborString( cbor ).toBuffer();
        return ConwayHeader.fromCborObj( Cbor.parse( bytes ), bytes );
    }
    static fromCborObj( cbor: CborObj, _originalBytes?: Uint8Array ): ConwayHeader
    {
        if(!(
            cbor instanceof CborArray &&
            cbor.array.length >= 2
        )) throw new Error("invalid cbor for ConwayHeader");

        const [
            cHdrBody,
            cBodySignature
        ] = cbor.array;

        if(!(
            cHdrBody instanceof CborArray &&
            cHdrBody.array.length >= 10 &&
            cBodySignature instanceof CborBytes
        )) throw new Error("invalid cbor for ConwayHeader");

        const [
            cBlockNo,
            cSlotNo,
            cPrevHash,
            cIssuerVkey,
            cVrfVkey,
            cVrfResult,
            cBlockBodySize,
            cBlockBodyHash,
            cOpCert,
            cProtVer
        ] = cHdrBody.array;

        if(!(
            cBlockNo instanceof CborUInt        &&
            cSlotNo  instanceof CborUInt        &&
            cPrevHash   instanceof CborBytes    &&
            cIssuerVkey instanceof CborBytes    &&
            cVrfVkey    instanceof CborBytes    &&
            cBlockBodySize instanceof CborUInt  &&
            cBlockBodyHash instanceof CborBytes
        )) throw new Error("invalid cbor for ConwayHeader");

        const vrfResult = vrfCertFromCborObj( cVrfResult );

        const originalWerePresent = _originalBytes instanceof Uint8Array;
        _originalBytes = _originalBytes instanceof Uint8Array ? _originalBytes : Cbor.encode( cbor ).toBuffer();
        
        const hdr = new ConwayHeader({
            hash: blake2b_256( _originalBytes ) as U8Arr32,
            prevHash: cPrevHash.buffer as U8Arr32,
            slotNo: cSlotNo.num,
            isEBB: false,
            blockNo: cBlockNo.num,
            issuerVkey: cIssuerVkey.buffer as U8Arr32,
            vrfVkey: cVrfVkey.buffer as U8Arr32,
            blockBodySize: cBlockBodySize.num,
            blockBodyHash: cBlockBodyHash.buffer as U8Arr32,
            operationalCert: opCertFromCborObj( cOpCert ),
            protocolVersion: protocolVersionFromCborObj( cProtVer ),
            bodySignature: cBodySignature.buffer,
            vrfResult,
        });

        if( originalWerePresent )
        {
            // @ts-ignore Cannot assign to 'cborBytes' because it is a read-only property.
            hdr.cborBytes = _originalBytes;
        }

        return hdr;
    }
}