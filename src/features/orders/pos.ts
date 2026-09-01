export type PosDraftLine = {
  catalogItemId: string | null;
  quantity: number;
  unitPrice: number;
  name?: string;
  description?: string;
  total?: number;
  taxCategory?: "taxable" | "exempt";
  taxRate?: number;
};

export type PosDraft = {
  clientId: string;
  lines: PosDraftLine[];
  discountPercent: number;
  discountReason: string;
  dueAt?: string;
  notes?: string;
  expectedVersion?: number;
};

export function buildOrderCartPayload(draft: PosDraft) {
  return {
    clientId: draft.clientId,
    lines: draft.lines.map(({ catalogItemId, quantity, unitPrice, name, description, taxCategory, taxRate }) => ({
      catalogItemId,
      ...(catalogItemId === null
        ? {
            name: name?.trim() ?? "",
            description: (description?.trim() || name?.trim()) ?? "",
            ...(taxCategory !== undefined ? { taxCategory } : {}),
            ...(taxRate !== undefined ? { taxRate } : {}),
          }
        : {}),
      quantity,
      unitPrice,
    })),
    discountPercent: draft.discountPercent,
    discountReason: draft.discountReason,
    dueAt: draft.dueAt,
    notes: draft.notes,
    expectedVersion: draft.expectedVersion,
  };
}
