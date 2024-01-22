export enum MuxMode {
    /**
     * Should only be used when running node-to-client
     * comunications **as the client**
     * 
     * Otherwhise prefer `InitiatorAndResponder`
    **/
    Initiator = 0,
    /**
     * To be used when we are meant to run the server
     * and the server only (half-duplex)
    **/
    Responder = 1,
    /**
     * full-duplex
     * 
     * to be used when we will run both server and client
    **/
    InitiatorAndResponder = 2
};

MuxMode.Initiator;
Object.freeze( MuxMode );