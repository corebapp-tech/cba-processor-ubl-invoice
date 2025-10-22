interface Address {
  street: string;
  city: string;
  postcode: string;
  country: string;
}

interface Party {
  id?: string;
  name: string;
  taxId: string;
  companyId: string;
  address: Address;
}

interface Tax {
  percent: number;
  amount: number;
}

interface Amounts {
  taxable: number;
  total: number;
}

interface InvoiceItem {
  name: string;
  description?: string;
  quantity: number;
  price: number;
  lineAmount: number;
  unitCode?: string;
}

interface UBLInvoiceRequest {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  accountingCost?: string;
  buyerReference?: string;
  supplier: Party;
  customer: Party;
  paymentTerms?: string;
  tax: Tax;
  amounts: Amounts;
  items: InvoiceItem[];
  outputFile?: string;
}

interface UBLInvoiceResponse {
  success: boolean;
  message: string;
  filePath?: string;
  xmlContent: string;
}
