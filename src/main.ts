import { create } from 'xmlbuilder2';

import { BaseProcessor } from '../../../core/processor/BaseProcessor';
import {
  Response,
  Request,
  ResponseBuilder,
} from '../../../core/processor/Http';
import { InputCastingService } from '../../../core/service/InputCastingService';
import { PodService, PodPushData } from '../../../core/service/PodService';

class UblInvoiceProcessor extends BaseProcessor {
  private validateAddress(address: Address, fieldName: string): void {
    this.validateRequired(address, fieldName);
    if (address) {
      this.validateRequired(address.street, `${fieldName}.street`);
      this.validateRequired(address.city, `${fieldName}.city`);
      this.validateRequired(address.postcode, `${fieldName}.postcode`);
      this.validateRequired(address.country, `${fieldName}.country`);
    }
  }

  private parseRequestBody(request: Request): any {
    try {
      return request.body || JSON.parse(request.body);
    } catch (error) {
      throw new Error('Invalid JSON request body');
    }
  }

  private generateUBLInvoice(params: UBLInvoiceRequest): string {
    const ns = {
      cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
      cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      ubl: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    };

    const doc = create({ version: '1.0', encoding: 'UTF-8' }).ele(
      ns.ubl,
      'Invoice',
      {
        'xmlns:cbc': ns.cbc,
        'xmlns:cac': ns.cac,
        xmlns: ns.ubl,
      }
    );

    doc.ele(ns.cbc, 'UBLVersionID').txt('2.1').up();

    doc
      .ele(ns.cbc, 'CustomizationID')
      .txt(
        'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0'
      )
      .up();

    doc
      .ele(ns.cbc, 'ProfileID')
      .txt('urn:fdc:peppol.eu:2017:poacc:billing:01:1.0')
      .up();

    doc.ele(ns.cbc, 'ID').txt(params.invoiceNumber).up();

    doc.ele(ns.cbc, 'IssueDate').txt(params.issueDate).up();

    doc.ele(ns.cbc, 'DueDate').txt(params.dueDate).up();

    doc.ele(ns.cbc, 'InvoiceTypeCode').txt('380').up();

    doc.ele(ns.cbc, 'DocumentCurrencyCode').txt(params.currency).up();

    if (params.accountingCost) {
      doc.ele(ns.cbc, 'AccountingCost').txt(params.accountingCost).up();
    }

    if (params.buyerReference) {
      doc.ele(ns.cbc, 'BuyerReference').txt(params.buyerReference).up();
    }

    this.addPartyToDocument(
      doc,
      ns,
      'AccountingSupplierParty',
      params.supplier
    );

    this.addPartyToDocument(
      doc,
      ns,
      'AccountingCustomerParty',
      params.customer
    );

    const paymentTerms = doc.ele(ns.cac, 'PaymentTerms');
    paymentTerms
      .ele(ns.cbc, 'Note')
      .txt(params.paymentTerms || '30 days from receipt of invoice')
      .up();
    paymentTerms.up();

    this.addTaxTotalToDocument(doc, ns, params);

    this.addLegalMonetaryTotalToDocument(doc, ns, params);

    this.addInvoiceLinesToDocument(doc, ns, params);

    return doc.end({ prettyPrint: true });
  }

  private addPartyToDocument(
    doc: any,
    ns: any,
    partyType: string,
    party: Party
  ): void {
    const partyElement = doc.ele(ns.cac, partyType);
    const partyDetails = partyElement.ele(ns.cac, 'Party');

    if (party.id) {
      const partyId = partyDetails.ele(ns.cac, 'PartyIdentification');
      partyId.ele(ns.cbc, 'ID').txt(party.id).up();
      partyId.up();
    }

    const partyName = partyDetails.ele(ns.cac, 'PartyName');
    partyName.ele(ns.cbc, 'Name').txt(party.name).up();
    partyName.up();

    const address = partyDetails.ele(ns.cac, 'PostalAddress');
    address.ele(ns.cbc, 'StreetName').txt(party.address.street).up();
    address.ele(ns.cbc, 'CityName').txt(party.address.city).up();
    address.ele(ns.cbc, 'PostalZone').txt(party.address.postcode).up();

    const country = address.ele(ns.cac, 'Country');
    country.ele(ns.cbc, 'IdentificationCode').txt(party.address.country).up();
    country.up();
    address.up();

    const taxScheme = partyDetails.ele(ns.cac, 'PartyTaxScheme');
    taxScheme.ele(ns.cbc, 'CompanyID').txt(party.taxId).up();
    const taxSchemeDetails = taxScheme.ele(ns.cac, 'TaxScheme');
    taxSchemeDetails.ele(ns.cbc, 'ID').txt('VAT').up();
    taxSchemeDetails.up();
    taxScheme.up();

    const legalEntity = partyDetails.ele(ns.cac, 'PartyLegalEntity');
    legalEntity.ele(ns.cbc, 'RegistrationName').txt(party.name).up();
    legalEntity.ele(ns.cbc, 'CompanyID').txt(party.companyId).up();
    legalEntity.up();

    partyDetails.up();
    partyElement.up();
  }

  private addTaxTotalToDocument(
    doc: any,
    ns: any,
    params: UBLInvoiceRequest
  ): void {
    const taxTotal = doc.ele(ns.cac, 'TaxTotal');
    taxTotal
      .ele(ns.cbc, 'TaxAmount', { currencyID: params.currency })
      .txt(params.tax.amount.toString())
      .up();

    const taxSubtotal = taxTotal.ele(ns.cac, 'TaxSubtotal');
    taxSubtotal
      .ele(ns.cbc, 'TaxableAmount', { currencyID: params.currency })
      .txt(params.amounts.taxable.toString())
      .up();
    taxSubtotal
      .ele(ns.cbc, 'TaxAmount', { currencyID: params.currency })
      .txt(params.tax.amount.toString())
      .up();

    const taxCategory = taxSubtotal.ele(ns.cac, 'TaxCategory');
    taxCategory.ele(ns.cbc, 'ID').txt('S').up();
    taxCategory.ele(ns.cbc, 'Percent').txt(params.tax.percent.toString()).up();

    const taxScheme = taxCategory.ele(ns.cac, 'TaxScheme');
    taxScheme.ele(ns.cbc, 'ID').txt('VAT').up();
    taxScheme.up();
    taxCategory.up();
    taxSubtotal.up();
    taxTotal.up();
  }

  private addLegalMonetaryTotalToDocument(
    doc: any,
    ns: any,
    params: UBLInvoiceRequest
  ): void {
    const legalMonetaryTotal = doc.ele(ns.cac, 'LegalMonetaryTotal');
    legalMonetaryTotal
      .ele(ns.cbc, 'LineExtensionAmount', { currencyID: params.currency })
      .txt(params.amounts.taxable.toString())
      .up();
    legalMonetaryTotal
      .ele(ns.cbc, 'TaxExclusiveAmount', { currencyID: params.currency })
      .txt(params.amounts.taxable.toString())
      .up();
    legalMonetaryTotal
      .ele(ns.cbc, 'TaxInclusiveAmount', { currencyID: params.currency })
      .txt(params.amounts.total.toString())
      .up();
    legalMonetaryTotal
      .ele(ns.cbc, 'PayableAmount', { currencyID: params.currency })
      .txt(params.amounts.total.toString())
      .up();
    legalMonetaryTotal.up();
  }

  private addInvoiceLinesToDocument(
    doc: any,
    ns: any,
    params: UBLInvoiceRequest
  ): void {
    params.items.forEach((item, index) => {
      const invoiceLine = doc.ele(ns.cac, 'InvoiceLine');
      invoiceLine
        .ele(ns.cbc, 'ID')
        .txt(String(index + 1))
        .up();

      invoiceLine
        .ele(ns.cbc, 'InvoicedQuantity', { unitCode: item.unitCode || 'EA' })
        .txt(item.quantity.toString())
        .up();

      invoiceLine
        .ele(ns.cbc, 'LineExtensionAmount', { currencyID: params.currency })
        .txt(item.lineAmount.toString())
        .up();

      const itemElement = invoiceLine.ele(ns.cac, 'Item');
      itemElement.ele(ns.cbc, 'Name').txt(item.name).up();

      if (item.description) {
        itemElement.ele(ns.cbc, 'Description').txt(item.description).up();
      }

      const itemTax = itemElement.ele(ns.cac, 'ClassifiedTaxCategory');
      itemTax.ele(ns.cbc, 'ID').txt('S').up();
      itemTax.ele(ns.cbc, 'Percent').txt(params.tax.percent.toString()).up();

      const itemTaxScheme = itemTax.ele(ns.cac, 'TaxScheme');
      itemTaxScheme.ele(ns.cbc, 'ID').txt('VAT').up();
      itemTaxScheme.up();
      itemTax.up();
      itemElement.up();

      const price = invoiceLine.ele(ns.cac, 'Price');
      price
        .ele(ns.cbc, 'PriceAmount', { currencyID: params.currency })
        .txt(item.price.toString())
        .up();
      price.up();

      invoiceLine.up();
    });
  }

  private castInputInvoiceData(data: UBLInvoiceRequest): UBLInvoiceRequest {
    const rootObject = InputCastingService.castObject<UBLInvoiceRequest>(
      data,
      {
        issueDate: { type: 'date' },
        dueDate: { type: 'date' },
      },
      { strict: true }
    );
    if (rootObject.success === false) {
      throw new Error(rootObject.error);
    }
    data = { ...data, ...rootObject.value };

    const taxObject = InputCastingService.castObject<Tax>(
      data.tax,
      {
        percent: { type: 'integer' },
        amount: { type: 'integer' },
      },
      { strict: true }
    );
    if (taxObject.success === false) {
      throw new Error(taxObject.error);
    }
    data['tax'] = { ...data.tax, ...taxObject.value };

    const amountsObject = InputCastingService.castObject<Amounts>(
      data.amounts,
      {
        taxable: { type: 'integer' },
        total: { type: 'integer' },
      },
      { strict: true }
    );
    if (amountsObject.success === false) {
      throw new Error(amountsObject.error);
    }
    data['amounts'] = { ...data.amounts, ...amountsObject.value };

    data['items'] = data.items.map<any>(item => {
      const itemObject = InputCastingService.castObject<InvoiceItem>(
        item,
        {
          quantity: { type: 'integer' },
          price: { type: 'integer' },
          lineAmount: { type: 'integer' },
        },
        { strict: true }
      );
      if (itemObject.success === false) {
        throw new Error(itemObject.error);
      }
      return { ...item, ...itemObject.value };
    });

    return data;
  }

  async process(request: Request): Promise<Response> {
    try {
      const invoiceData = this.parseRequestBody(request) as UBLInvoiceRequest;
      const invoiceDataFormatted = this.castInputInvoiceData(invoiceData);
      const xmlContent = this.generateUBLInvoice(invoiceDataFormatted);

      const podService = new PodService(
        process.env.POD_UPDATE_INVOICE_ID as string,
        {
          namespace: process.env.INSTANCE_NAMESPACE as string,
        },
        {
          type: 'bearerToken',
          value: process.env.POD_UPDATE_INVOICE_AUTH_TOKEN as string,
        }
      );
      const data: PodPushData = {
        ubl_file: podService.getPushDataFile(
          xmlContent,
          `${invoiceData.invoiceNumber}_${Date.now()}.xml`
        ),
      };
      const queryParams: any = request.query;
      return podService
        .push(queryParams['record_id'], data)
        .then(response => {
          const httpCode = response.status;
          return ResponseBuilder.create(httpCode, {
            success: httpCode === 200,
          });
        })
        .catch(response => {
          return ResponseBuilder.error('An error has occurred');
        });
    } catch (error) {
      const message = (error as Error)?.message || 'Unknown error';
      this.logError(`Error: ${message}`);
      return ResponseBuilder.badRequest(`${message}`);
    }
  }
  async validateInput(request: Request): Promise<void> {
    this.validateRequestBodyRequired(request);
    this.validateRequestQueryParamRequired(request, 'record_id');

    const data = this.parseRequestBody(request) as UBLInvoiceRequest;

    this.validateRequired(data.invoiceNumber, 'invoiceNumber');
    this.validateRequired(data.issueDate, 'issueDate');
    this.validateRequired(data.dueDate, 'dueDate');
    this.validateRequired(data.currency, 'currency');

    this.validateRequired(data.supplier, 'supplier');
    if (data.supplier) {
      this.validateRequired(data.supplier.name, 'supplier.name');
      this.validateRequired(data.supplier.taxId, 'supplier.taxId');
      this.validateRequired(data.supplier.companyId, 'supplier.companyId');
      this.validateAddress(data.supplier.address, 'supplier.address');
    }

    this.validateRequired(data.customer, 'customer');
    if (data.customer) {
      this.validateRequired(data.customer.name, 'customer.name');
      this.validateRequired(data.customer.taxId, 'customer.taxId');
      this.validateRequired(data.customer.companyId, 'customer.companyId');
      this.validateAddress(data.customer.address, 'customer.address');
    }

    this.validateRequired(data.tax, 'tax');
    if (data.tax) {
      this.validateRequired(data.tax.percent, 'tax.percent');
      this.validateRequired(data.tax.amount, 'tax.amount');
    }

    this.validateRequired(data.amounts, 'amounts');
    if (data.amounts) {
      this.validateRequired(data.amounts.taxable, 'amounts.taxable');
      this.validateRequired(data.amounts.total, 'amounts.total');
    }

    this.validateRequired(data.items, 'items');
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('Items must be an array with at least one element.');
    }
    data.items.forEach((item, index) => {
      this.validateRequired(item.name, `items[${index}].name`);
      this.validateRequired(item.quantity, `items[${index}].quantity`);
      this.validateRequired(item.price, `items[${index}].price`);
      this.validateRequired(item.lineAmount, `items[${index}].lineAmount`);
    });
  }
}

export const processor = UblInvoiceProcessor;
