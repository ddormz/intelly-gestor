import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/session", () => ({ requireUser: vi.fn(async () => ({ userId: "user-1", role: "operator" })) }));
vi.mock("@/features/billing/evidence", () => ({ getFiscalEvidenceArtifact: vi.fn(async () => ({ bytes: new Uint8Array(Buffer.from("<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?><DTE/>", "latin1")), folio: "42", encoding: "ISO-8859-1" })) }));

import { GET } from "@/app/api/invoices/[id]/xml/route";

describe("fiscal XML download route", () => {
  it("returns exact bytes and the preserved XML charset", async () => {
    const response = await GET(new Request("http://localhost/api/invoices/invoice-1/xml"), { params: Promise.resolve({ id: "invoice-1" }) });
    expect(response.headers.get("content-type")).toBe("application/xml; charset=ISO-8859-1");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(Buffer.from("<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?><DTE/>", "latin1")));
  });
});
