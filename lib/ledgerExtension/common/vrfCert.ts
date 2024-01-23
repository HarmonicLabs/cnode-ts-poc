import { CborArray, CborBytes, CborObj } from "@harmoniclabs/cbor";
import { U8Arr } from "../types";

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