```mermaid
flowchart TD
    Start
    ReservedOutbound

    Start --"maybe connect later"--> ReservedOutbound
    ReservedOutbound --Connected--> Unnegotiated_Outbound
    Start --Accepted--> Unnegotiated_Inbound
```