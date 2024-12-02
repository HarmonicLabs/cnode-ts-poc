
let _os_availableParallelism: number | undefined = undefined;

(async () => {
    try {
        _os_availableParallelism = (await import('node:os')).availableParallelism();
    } catch {}
    // availableParallelism was added in node js versions: v19.4.0, v18.14.0
    // support for earlier versions via `os.cpus().length` (Added in: v0.3.3)
    if( typeof _os_availableParallelism !== 'number' )
    {
        try {
            _os_availableParallelism = (await import('node:os')).cpus().length;
        } catch {}
    }
})()

// some browsers may report less than the actual aviable threads.
// most cpus will support at least 4 threads, if not, 4 threads will be scheduled (concurrently).
// if you test `navigator.hardwareConcurrency` in a browser, you may see a number less than 4.
const MIN_WORKERS = 4;

export function getMaxWorkers(): number
{
    let realNum = typeof globalThis.navigator === 'undefined' ? _os_availableParallelism : globalThis.navigator.hardwareConcurrency;
    realNum = typeof realNum === 'number' ? realNum : MIN_WORKERS;
    return Math.max( realNum | 0, MIN_WORKERS );
}