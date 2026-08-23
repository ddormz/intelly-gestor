export type PosDraftLine = {
  catalogItemId: string | null;
  quantity: number;
  unitPrice: number;
  name?: string;
  total?: number;
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
    lines: draft.lines.map(({ catalogItemId, quantity, unitPrice, name }) => ({ catalogItemId, ...(catalogItemId === null ? { description: name?.trim() ?? "" } : {}), quantity, unitPrice })),
    discountPercent: draft.discountPercent,
    discountReason: draft.discountReason,
    dueAt: draft.dueAt,
    notes: draft.notes,
    expectedVersion: draft.expectedVersion,
  };
}
