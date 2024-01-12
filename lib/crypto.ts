import { createHash } from "blake2";

export function blake2b_256( data: Uint8Array ): Uint8Array
{
    return Uint8Array.prototype.slice.call(
        createHash("blake2b", { digestLength: 32 }).update(Buffer.from( data )).digest()
    );
}
