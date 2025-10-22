# UBL 2.0 Invoice Generator for CoreBapp

A processor service that generates UBL 2.0 compliant XML invoices and pushes them to CoreBapp namespaces via Push-Inbound POD.

## Overview

This processor receives invoice data from a CoreBapp namespace via Push-Outbound POD, validates and transforms the data, generates a UBL 2.0 XML invoice file, and sends it back to CoreBapp using the PodService Push-Inbound POD integration.

### What is UBL 2.0?

UBL 2.0 (Universal Business Language version 2.0) is an electronic invoice format in XML that enables automated data exchange between businesses. It provides a standardized, structured way to represent all information from a traditional paper invoice in a machine-readable format.

## Flow Diagram

```
CoreBapp Namespace (Push-Outbound POD)
           ↓
    [Invoice Data JSON]
           ↓
   This Processor Service
    - Validates data
    - Casts types
    - Generates UBL 2.0 XML
           ↓
    PodService (Push-Inbound POD)
           ↓
CoreBapp Namespace (Push-Inbound POD)
    - Saves XML file to file field
```

## Prerequisites

### CoreBapp Setup

1. **A CoreBapp namespace** configured with:

   - A **Push-Outbound POD** that sends invoice payload to this processor
   - A **Push-Inbound POD** that receives the generated XML file and saves it to a file field

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
INSTANCE_NAMESPACE=your-corebapp-namespace
POD_UPDATE_INVOICE_ID=your-push-inbound-pod-id
POD_UPDATE_INVOICE_AUTH_TOKEN=your-push-inbound-pod-authentication-token
```

### Variable Descriptions

- `INSTANCE_NAMESPACE`: The CoreBapp namespace identifier where the invoice will be sent
- `POD_UPDATE_INVOICE_ID`: The ID of the Push-Inbound POD that will receive the generated XML file
- `POD_UPDATE_INVOICE_AUTH_TOKEN`: Authentication token for the POD service

## Invoice Payload Schema

The processor expects the following JSON payload structure:

```json
{
  "invoiceNumber": "string",
  "issueDate": "date",
  "dueDate": "date",
  "currency": "string",
  "supplier": {
    "id": "string",
    "name": "string",
    "taxId": "string",
    "companyId": "string",
    "address": {
      "street": "string",
      "city": "string",
      "postcode": "string",
      "country": "string"
    }
  },
  "customer": {
    "name": "string",
    "taxId": "string",
    "companyId": "string",
    "address": {
      "street": "string",
      "city": "string",
      "postcode": "string",
      "country": "string"
    }
  },
  "tax": {
    "percent": "number",
    "amount": "number"
  },
  "amounts": {
    "taxable": "number",
    "total": "number"
  },
  "items": [
    {
      "name": "string",
      "description": "string",
      "quantity": "number",
      "price": "number",
      "lineAmount": "number",
      "unitCode": "string"
    }
  ]
}
```

### Field Descriptions

- **invoiceNumber**: Unique invoice identifier
- **issueDate**: Invoice issue date (ISO 8601 format)
- **dueDate**: Payment due date (ISO 8601 format)
- **currency**: Currency code (e.g., "USD", "EUR", "RON")
- **supplier**: Information about the invoice issuer
  - **id**: Supplier unique identifier
  - **name**: Company name
  - **taxId**: Tax identification number
  - **companyId**: Company registration number
  - **address**: Physical address details
- **customer**: Information about the invoice recipient
- **tax**: Tax calculation details
  - **percent**: Tax rate percentage
  - **amount**: Calculated tax amount
- **amounts**: Invoice totals
  - **taxable**: Subtotal before tax
  - **total**: Grand total including tax
- **items**: Array of invoice line items
  - **name**: Item/service name
  - **description**: Detailed description
  - **quantity**: Quantity ordered
  - **price**: Unit price
  - **lineAmount**: Line total (quantity × price)
  - **unitCode**: Unit of measure code (e.g., "EA", "HUR", "KGM")
