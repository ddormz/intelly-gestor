# IntellyDTE Adapter Contract

This internal contract is stable even while the provider's live HTTP contract is pending.

## Configuration

- `INTELLYDTE_MODE=fake|http`
- `INTELLYDTE_BASE_URL` (HTTP mode only)
- `INTELLYDTE_API_KEY` (HTTP mode only, server secret)
- `INTELLYDTE_COMPANY_TAX_ID` (HTTP mode only)
- `INTELLYDTE_TIMEOUT_MS` (bounded, default 10 seconds)

The integration screen exposes only mode, health, last verification, and masked identity. It never
returns the API key or raw authorization headers.

## Interface

```ts
type IssueInvoiceCommand = {
  idempotencyKey: string;
  correlationId: string;
  orderNumber: string;
  documentType: "factura-electronica";
  issuerTaxId: string;
  recipient: {
    taxId: string;
    legalName: string;
    email?: string;
    address: string;
    commune: string;
  };
  lines: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    taxRate: string;
    total: string;
  }>;
  totals: { net: string; exempt: string; tax: string; total: string; currency: "CLP" };
};

type IssueInvoiceResult =
  | { kind: "issued"; providerDocumentId: string; folio: string; issuedAt: string }
  | { kind: "rejected"; code: string; safeMessage: string; retryable: false }
  | { kind: "pending"; providerDocumentId?: string; retryAfterSeconds?: number }
  | { kind: "unavailable"; code: string; safeMessage: string; retryable: true };

interface IntellyDteGateway {
  health(): Promise<{ ok: boolean; checkedAt: string; safeMessage: string }>;
  issueInvoice(command: IssueInvoiceCommand): Promise<IssueInvoiceResult>;
  getInvoiceStatus(providerDocumentId: string): Promise<IssueInvoiceResult>;
}
```

## Safety rules

1. The application creates the local invoice and integration attempt before the remote call.
2. The idempotency key is stable for the order and provider operation.
3. A timeout produces an unknown/pending outcome, not an automatic second create call.
4. A retry first uses `getInvoiceStatus` when a provider identifier or uncertain outcome exists.
5. Logs contain correlation ID, safe status, and hashes only; credentials and customer payloads are
   never logged.
6. HTTP endpoint paths, authentication headers, provider field mapping, signature rules, and sandbox
   fixtures MUST be implemented from the authoritative contract supplied by IntellyDTE. Until then,
   HTTP mode fails closed with a configuration error and fake mode is the only executable adapter.
