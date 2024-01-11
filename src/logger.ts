export enum LoggerMinPriority {
    Info = 0,
    Debug = 1,
    Warning = 2,
    Error = 3
}

export const logger = {
    minPriority: LoggerMinPriority.Info,
    info( ...args: any[] )
    {
        if( logger.minPriority >= LoggerMinPriority.Info )
        console.log(`[Info][${new Date().toString()}]:`, ...args );
    },
    debug( ...args: any[] )
    {
        if( logger.minPriority >= LoggerMinPriority.Debug )
        console.log(`[Debug][${new Date().toString()}]:`, ...args );
    },
    warn( ...args: any[] )
    {
        if( logger.minPriority >= LoggerMinPriority.Warning )
        console.warn(`[Warning][${new Date().toString()}]:`, ...args );
    },
    error( ...args: any[] )
    {
        console.error(`[Error][${new Date().toString()}]:`, ...args );
    }
};