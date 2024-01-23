import { CborObj, CborBytes, CborUInt, CborArray } from "@harmoniclabs/cbor";
import { U8Arr32, U8Arr } from "../types";

/**
 * from the shelley to the alonzo eras the `operational_cert` is "inlined" in the header
 * so it is serialized using `opCertToCborObjElems`
 * and then using the spread operator (`...`) on the result
 * 
 * since babbage it is serialized as an array with the 4 fields,
 * so `opCertToCborObj` will be used instead.
 */
export interface IOperationalCert {
    hotVkey: U8Arr32,
    sequenceNumber: bigint,
    kesPeriod: bigint,
    signature: U8Arr<64>
}

/**
 * shelley to alonzo 
**/
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

/**
 * babbage and above
**/
export function opCertToCborObj( opCert: IOperationalCert ): CborArray
{
    return new CborArray( opCertToCborObjElems( opCert ) );
}

/**
 * babbage and above
**/
export function opCertFromCborObj( cbor: CborObj ): IOperationalCert
{
    if(!(
        cbor instanceof CborArray &&
        cbor.array.length >= 4 &&
        cbor.array[0] instanceof CborBytes &&
        cbor.array[1] instanceof CborUInt &&
        cbor.array[2] instanceof CborUInt &&
        cbor.array[3] instanceof CborBytes
    )) throw new Error("invalid cbor for IOperationalCert");

    return {
        hotVkey: cbor.array[0].buffer as U8Arr32,
        sequenceNumber: cbor.array[1].num,
        kesPeriod: cbor.array[2].num,
        signature: cbor.array[3].buffer as U8Arr<64>
    };
}