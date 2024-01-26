export function runSafe<V>( stuff: () => V ): V | undefined
{
    try { return stuff(); }
    catch { return undefined };
}