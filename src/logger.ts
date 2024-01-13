import color from "picocolors";

export enum LoggerPriority {
    Info = 0,
    Debug = 1,
    Warning = 2,
    Error = 3
}

Object.freeze( LoggerPriority );

export const logger = {
    minPriority: LoggerPriority.Info,
    info( ...args: any[] )
    {
        if( logger.minPriority <= LoggerPriority.Info )
        console.log(
            color.cyan(`[Info][${new Date().toUTCString()}]:`),
            ...args
        );
    },
    debug( ...args: any[] )
    {
        if( logger.minPriority <= LoggerPriority.Debug )
        console.log(
            color.blue(`[Debug][${new Date().toUTCString()}]:`),
            ...args
        );
    },
    warn( ...args: any[] )
    {
        if( logger.minPriority <= LoggerPriority.Warning )
        console.warn(
            color.yellow(`[Warning][${new Date().toUTCString()}]:`),
            ...args
        );
    },
    error( ...args: any[] )
    {
        console.error(
            color.red(`[Error][${new Date().toUTCString()}]:`),
            ...args
        );
    }
};