AgriRent — External SOAP Partner Integration Benchmark

Course: CS543: Web Services (Assignment 3 of 14)

Team ID: 04

Team Members:
1. Akshay Kumar-20251651012
2. Sundram Tripathi-20251651091,(Lead)
3. Abhinav Kumar Chandravanshi -20251651004
4. Ankit Kumar -20251651022

System Name: AgriRent (Peer-to-Peer Agricultural Equipment Marketplace)

Partner Service: AgriPay Escrow Gateway (AgriPayEscrowService)

Task 1: Context & Justification for SOAP Edge

1.1 Partner Selection & Integrated Operation

AgriRent integrates with AgriPay Escrow Gateway, an external banking-grade partner handling financial authorizations, multi-party escrow holds, and rental security deposits. The specific operation integrated at this boundary is:

Operation: authorizeEscrowHold

Calling Service: AgriRent Payment Service (PaymentService)

Purpose: To atomically pre-authorize the calculated equipment rental fee and freeze the required security deposit amount within an audited third-party banking escrow vault before machine dispatch.

1.2 Protocol Justification: Why SOAP Over REST?

While internal AgriRent microservices communicate using lightweight, resource-oriented REST/JSON endpoints, the external escrow integration edge strictly requires SOAP for the following architectural reasons:

Rigid Machine-Readable Contract & Schema Governance: Financial compliance demands zero tolerance for payload ambiguity. The WSDL file explicitly defines XML Schema types (xsd:decimal, xsd:dateTime, precise string constraints) and namespaces. Both parties can generate static client stubs that validate inputs and outputs at compile time, eliminating breaking runtime payload drift.

Message-Level Security & Non-Repudiation: Banking integrations require security tokens and digital signatures to reside directly inside the message payload (soap:Header) rather than relying solely on transport-layer TLS. By decoupling security from the transport medium, the SOAP envelope can transit intermediary banking proxies and audit log servers without exposing sensitive credentials or breaking end-to-end non-repudiation guarantees.

Formalized ACID-Grade Transactional Semantics: Escrow operations govern substantial capital transactions between farmers and equipment owners. SOAP’s standard fault architecture (soap:Fault with structured detail elements) enforces deterministic transactional state transitions and clear error semantics, preventing silent failures or ambiguously dropped network packets during multi-phase hold operations.

Task 4: HTTP Binding Specification

The WSDL contract specifies AgriPayEscrowSoapBinding, binding the abstract authorizeEscrowHold operation to an HTTP POST transport. Below is the raw HTTP wire-level transmission header block and payload structure carrying the SOAP request.

POST /v2/soap/escrow HTTP/1.1
Host: escrow-gateway.agripay.bank.in
Content-Type: text/xml; charset=utf-8
Content-Length: 948
SOAPAction: "http://escrow.agripay.bank.in/ws/escrow/authorizeEscrowHold"
User-Agent: AgriRent-PaymentGateway-Client/1.0
Connection: keep-alive

<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:esc="http://escrow.agripay.bank.in/ws/escrow">
  <soapenv:Header>
    <esc:PartnerAuthHeader>
      <esc:MerchantId>AGRIRENT_INDIA_M0921</esc:MerchantId>
      <esc:ApiKey>sk_live_9f81a7b64c20e1189dbe567a1029384c</esc:ApiKey>
    </esc:PartnerAuthHeader>
  </soapenv:Header>
  <soapenv:Body>
    <esc:AuthorizeEscrowHoldRequest>
      <esc:BookingReference>AGRI-BKG-2026-90412</esc:BookingReference>
      <esc:PayerVpaOrToken>farmer.ramesh@okaxis</esc:PayerVpaOrToken>
      <esc:RentalFeeAmount>10500.00</esc:RentalFeeAmount>
      <esc:SecurityDepositAmount>5000.00</esc:SecurityDepositAmount>
      <esc:Currency>INR</esc:Currency>
    </esc:AuthorizeEscrowHoldRequest>
  </soapenv:Body>
</soapenv:Envelope>


Key HTTP Binding Artifacts:

HTTP Method: POST

Target Host: escrow-gateway.agripay.bank.in

Endpoint Path: /v2/soap/escrow (Derived directly from soap:address location in partner.wsdl)

Content-Type: text/xml; charset=utf-8 (Standard MIME type for SOAP 1.1 bindings)

SOAPAction Header: "http://escrow.agripay.bank.in/ws/escrow/authorizeEscrowHold" (Matches the soap:operation declaration in partner.wsdl)

Task 5: Service Discovery (Modern Enterprise Form)

5.1 Discovery Model Description

In modern service-oriented and microservice architectures, heavy centralized UDDI (Universal Description, Discovery, and Integration) operator registries have been deprecated in favor of lightweight, version-controlled developer portals and automated service catalog registries (such as Backstage, AWS Service Catalog, or HashiCorp Consul).

AgriRent obtains the partner WSDL through a federated enterprise service catalog entry. When onboarding the AgriPay Escrow Gateway:

The partner provides a secure, version-controlled repository endpoint hosting the canonical contract.

AgriRent's CI/CD pipeline reads this catalog record to download the authoritative WSDL artifact during build time.

Code generation tools (wsimport or Node.js soap generators) compile the WSDL into client proxy stubs.

The service URL and authentication parameters are injected into runtime environment configurations, guaranteeing deterministic resolution without depending on an active runtime lookup server.

5.2 One-Record Modern Enterprise Catalog / Registry Entry

{
  "$schema": "https://agrirent.internal/schemas/service-catalog-record.v1.json",
  "registryId": "reg-partner-agripay-0042",
  "business": {
    "name": "AgriPay Agricultural Banking & Escrow Services Ltd.",
    "partnerTier": "Tier-1 Certified Financial Provider",
    "contact": "integrations@agripay.bank.in",
    "supportPhone": "+91-1800-209-4112"
  },
  "service": {
    "name": "AgriPayEscrowService",
    "domain": "Financial Settlement & Escrow Holding",
    "environment": "Production-India-Central",
    "protocol": "SOAP 1.1 over HTTP/TLS"
  },
  "endpoint": {
    "productionUrl": "https://escrow-gateway.agripay.bank.in/v2/soap/escrow",
    "sandboxUrl": "https://sandbox-gateway.agripay.bank.in/v2/soap/escrow",
    "networkZone": "Banking DMZ / PCI-DSS Zone 2"
  },
  "technicalInterfacePointer": {
    "tModelType": "WSDL_DOCUMENT",
    "contractNamespace": "http://escrow.agripay.bank.in/ws/escrow",
    "wsdlUri": "https://escrow-gateway.agripay.bank.in/v2/soap/escrow?wsdl",
    "localCachedReference": "assignment 3/partner.wsdl",
    "hashSha256": "8f3b618a8b11c9d64e9a1127e7f9a8b92b67d93427fef6349c118e9a263158b0",
    "version": "2.4.0"
  }
}


Task 6: Fault Mapping (Contract Isolation & Anti-Corruption)

6.1 Architectural Principle

To prevent partner-specific vocabulary, vendor error codes, and banking-layer implementation details from leaking into AgriRent’s domain layer or to platform renters, the AgriRent Payment Service acts as an Anti-Corruption Layer (ACL).

The external partner's SOAP fault is intercepted by the consumer proxy, parsed, and translated strictly into the canonical error responses promised in AgriRent's Assignment 2 Service Contract and central requestBooking specification.

6.2 Fault Mapping Matrix

Partner SOAP Fault Code

Partner Detail (PartnerErrorCode)

Partner Error Description

AgriRent Assignment 2 Contract Error

AgriRent Renter/Owner Front-Facing Response

soapenv:Client

ERR_INSUFFICIENT_FUNDS

Remitter account has insufficient funds to clear escrow reserve.

PAYMENT_DECLINED

"Payment Authorization Failed: Your bank account has insufficient balance to complete the required rental deposit."

soapenv:Client

ERR_INVALID_VPA_TOKEN

UPI handle or card token failed authentication or checksum validation.

INVALID_PAYMENT_TOKEN

"Invalid Payment Method: The payment details provided could not be verified. Please update your payment method."

soapenv:Client

ERR_LIMIT_EXCEEDED

Daily transactional limit reached for rural agricultural banking mandate.

PAYMENT_DECLINED

"Transaction Limit Reached: The requested amount exceeds your daily transaction ceiling. Please contact your bank."

soapenv:Server

ERR_GATEWAY_TIMEOUT

Escrow settlement node timed out connecting to the central clearing house.

GATEWAY_UNAVAILABLE

"Payment Service Temporarily Unavailable: Could not connect to the escrow banking network. Please retry in a few moments."

soapenv:Server

ERR_DUPLICATE_ESCROW_REF

A hold already exists under the supplied booking identifier.

ALREADY_HANDLED

"Duplicate Authorization: An active hold is already associated with this booking."

6.3 Anti-Corruption Code Translation Flow

[ AgriPay Banking Gateway ]
         │
         ▼ (Raw SOAP 1.1 Fault)
 <soapenv:Fault>
   <faultcode>soapenv:Client</faultcode>
   <faultstring>Escrow reservation transaction rejected by upstream clearing</faultstring>
   <detail>
     <esc:EscrowFaultDetail>
       <esc:PartnerErrorCode>ERR_INSUFFICIENT_FUNDS</esc:PartnerErrorCode>
     </esc:EscrowFaultDetail>
   </detail>
 </soapenv:Fault>
         │
         ▼ (Caught by AgriRent Payment Service Consumer Adapter)
 PaymentService.translateSoapFault(fault)
         │
         ▼ (Mapped to Assignment 2 Service Contract)
 throw new BookingDomainException({
   status: 400,
   error: "PAYMENT_DECLINED",
   message: "Payment Authorization Failed: Insufficient funds for deposit hold."
 });
         │
         ▼ (Clean REST Response to Central Coordinator)
 HTTP/1.1 400 Bad Request
 {
   "status": "FAILED",
   "errorCode": "PAYMENT_DECLINED",
   "bookingId": "AGRI-BKG-2026-90412"
 }
