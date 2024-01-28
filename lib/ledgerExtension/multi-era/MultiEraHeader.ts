import { CanBeCborString, Cbor, CborObj, forceCborString } from "@harmoniclabs/cbor";
import { AllegraHeader } from "../allegra";
import { AlonzoHeader } from "../alonzo/AlonzoHeader";
import { BabbageHeader } from "../babbage/BabbageHeader";
import { ByronHeader } from "../byron/ByronHeader";
import { MaryHeader } from "../mary/MaryHeader";
import { ShelleyHeader } from "../shelley";
import { roDescr } from "../../utils/roDescr";
import { getEraIdxAndHeaderBytes } from "./getEraIdxAndHeaderBytes";
import { ByronEbbHeader } from "../byron/ByronEbbHeader";
import { logger } from "../../../src/logger";
import { toHex } from "@harmoniclabs/uint8array-utils";

export enum EraIndex {
    Byron = 0,
    Shelley = 1,
    Allegra = 2,
    Mary = 3,
    Alonzo = 4,
    Babbage = 5
}

Object.freeze( EraIndex );

export type AnyEraHeader
    = ByronEbbHeader
    | ByronHeader
    | ShelleyHeader
    | AllegraHeader
    | MaryHeader
    | AlonzoHeader
    | BabbageHeader;

export type RealHeader<EraIdx extends EraIndex> =
    EraIdx extends EraIndex.Byron         ? ByronHeader | ByronEbbHeader :
    EraIdx extends EraIndex.Shelley          ? ShelleyHeader :
    EraIdx extends EraIndex.Allegra          ? AllegraHeader :
    EraIdx extends EraIndex.Mary             ? MaryHeader :
    EraIdx extends EraIndex.Alonzo           ? AlonzoHeader :
    EraIdx extends EraIndex.Babbage          ? BabbageHeader :
    never

export interface IMultiEraHeader<EraIdx extends EraIndex = EraIndex> {
    readonly eraIndex: EraIdx;
    readonly header: RealHeader<EraIdx>;
}

export class MultiEraHeader<EraIdx extends EraIndex = EraIndex>
    implements IMultiEraHeader<EraIdx>
{
    readonly eraIndex: EraIdx;
    readonly header: RealHeader<EraIdx>;

    constructor({ eraIndex, header }: IMultiEraHeader<EraIdx>)
    {
        Object.defineProperties(
            this, {
                eraIndex: { value: eraIndex, ...roDescr },
                header: { value: header, ...roDescr },
            }
        );
    }

    static fromCbor( cbor: CanBeCborString ): MultiEraHeader
    {
        const bytes = cbor instanceof Uint8Array ? cbor : forceCborString( cbor ).toBuffer();
        return MultiEraHeader.fromCborObj( Cbor.parse( bytes ), bytes );
    }
    static fromCborObj( cbor: CborObj, _originalBytes?: Uint8Array ): MultiEraHeader
    {
        if(!( _originalBytes instanceof Uint8Array ))
        {
            _originalBytes = Cbor.encode( cbor ).toBuffer();
        }
        const { eraIdx, headerBytes } = getEraIdxAndHeaderBytes( _originalBytes );
        let header: AnyEraHeader;
        switch( eraIdx )
        {
            case EraIndex.Byron: {
                try {
                    header = ByronEbbHeader.fromCbor( headerBytes );
                } catch (e) {
                    try {
                        header = ByronHeader.fromCbor( headerBytes );
                    } catch (b) {
                        logger.error( eraIdx, toHex( headerBytes ) );
                        throw b;
                    }
                }
                break;
            }
            case EraIndex.Shelley:          header = ShelleyHeader.fromCbor( headerBytes ); break;
            case EraIndex.Allegra:          header = AllegraHeader.fromCbor( headerBytes ); break;
            case EraIndex.Mary:             header = MaryHeader.fromCbor( headerBytes );    break;
            case EraIndex.Alonzo:           header = AlonzoHeader.fromCbor( headerBytes );  break;
            case EraIndex.Babbage:          header = BabbageHeader.fromCbor( headerBytes ); break;
            default: throw new Error("invalid era index: " + eraIdx.toString());
        }
        return new MultiEraHeader({
            eraIndex: eraIdx,
            header
        });
    }

    static isByronEBB( hdr: MultiEraHeader ): hdr is MultiEraHeader<EraIndex.Byron>
    {
        return (
            hdr.eraIndex === EraIndex.Byron
        ) && (
            hdr.header instanceof ByronEbbHeader
        );
    }
    static isByron( hdr: MultiEraHeader ): hdr is MultiEraHeader<EraIndex.Byron>
    {
        return hdr.eraIndex === EraIndex.Byron && hdr.header instanceof ByronHeader;
    }
    static isShelley( hdr: MultiEraHeader ): hdr is MultiEraHeader<EraIndex.Shelley>
    {
        return hdr.eraIndex === EraIndex.Shelley;
    }
    static isAllegra( hdr: MultiEraHeader ): hdr is MultiEraHeader<EraIndex.Allegra>
    {
        return hdr.eraIndex === EraIndex.Allegra;
    }
    static isMary( hdr: MultiEraHeader ): hdr is MultiEraHeader<EraIndex.Mary>
    {
        return hdr.eraIndex === EraIndex.Mary;
    }
    static isAlonzo( hdr: MultiEraHeader ): hdr is MultiEraHeader<EraIndex.Alonzo>
    {
        return hdr.eraIndex === EraIndex.Alonzo;
    }
    static isBabbage( hdr: MultiEraHeader ): hdr is MultiEraHeader<EraIndex.Babbage>
    {
        return hdr.eraIndex === EraIndex.Babbage;
    }
}