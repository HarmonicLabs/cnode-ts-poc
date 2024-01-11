# Cardano Node Proof of Concept implementation in Typesript

## The goal

To have a fully working **passive** cardano node as described in the [ouroboros-consensus documentation](https://ouroboros-consensus.cardano.intersectmbo.org/docs/for-developers/ComponentDiagram/) and represented in the diagram reported below

```mermaid
flowchart LR
    ChainSel["Chain Selection"]
    UPA["Upstream Peers Adapter"]
    BP["ChainDB"]

    ChainSel --"H(L)"--> UPA --"B"--> ChainSel
    ChainSel --"B"--> BP --"O(L)"--> ChainSel

    BP -."B".-> ChainSel
    BP -."I(L)".-> ChainSel
```
Legend:
```mermaid
flowchart LR
    Publisher
    Subscriber
    Requester
    Server
    a[" "]
    b[" "]
    c[" "]
    d[" "]

   Publisher -- latest payload --> Subscriber
   Server -. requested payload .-> Requester

   a -- "B = Block" --> b
   a -- "L = Ledger State" --> b

   c -- "H(X) = Header of X" --> d
   c -- "I(X) = Only during Initialization" --> d
   c -- "O(X) = occasionally pushing X" --> d
```

## Why?

This project will serve as a base for many other goals:

1) proving the feasibility of the following Catalyst F11 proposals:
    
    - [consensus](https://cardano.ideascale.com/c/idea/110904)
    - [network](https://cardano.ideascale.com/c/idea/111634)
    - [ledger](https://cardano.ideascale.com/c/idea/110903)

2) serve as base to then extract the only missing component fo a proper typescript cardano node ( the consensus component, as the network can be find here, and the ledger here )

3) serve as a base to then extract the "runtime indipendent" code and have a passive node running in browsers (future project)

4) be the example project for future, purpose specific nodes, that don't require all the work that a full node does, some examples (just on top of my head) could be:

    - light weight node following only the tip of the chain (example usages: some mini-protocols servers or ad-hoc chain indexer saving blocks elsewhere)
    - node that only keeps the ledger state, for optimal UTxO queries
    - etc.