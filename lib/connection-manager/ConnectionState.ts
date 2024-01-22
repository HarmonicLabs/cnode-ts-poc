export enum ConnectionState {
    /** Connection manager is about ot connect to a peer */
    ReservedOutgoing = 0,
    /** Connected to peer, ongoing handshake negotiation */
    Unnegotiated_In,
    Unnegotiated_Out,
    /** **TO AVOID**
     * 
     * Outgoing connection; inbound idle with timeout */
    Outgoing_T_HalfDuplex,
    /** **TO AVOID**
     * 
     * Outgoing connection; inbound idle with timeout */
    Outgoing_T_FullDuplex,
    /** Outgoing connection; inbound timeout expired */
    Outgoing_HalfDuplex,
    /** Outgoing connection; inbound timeout expired */
    Outgoing_FullDuplex,
    /** Incoming connection, not used yet,
     * expires after timeout */
    IncomingIdle_HalfDuplex,
    /** Incoming connection, not used yet,
     * expires after timeout */
    IncomingIdle_FullDuplex,
    /** Active inbound connection */
    Incoming_HalfDuplex,
    /** Active inbound connection */
    Incoming_FullDuplex,
    /** running connection */
    Duplex,
    /** about to close the connection, termporarily idle,
     * effectively closes after timeout */
    OutgoingIdle,
    /** connection closed, de-allocating resources */
    Terminating,
    /** connection closed and all resources de-allocated */
    Terminated
}