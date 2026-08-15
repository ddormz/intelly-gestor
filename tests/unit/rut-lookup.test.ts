import { beforeEach, describe, expect, it, vi } from "vitest";
import { getIntellyDteConfig } from "@/features/integrations/config-service";
import { lookupClientRut } from "@/features/clients/rut-lookup";
import { GET } from "@/app/api/clients/rut/[rut]/route";

vi.mock("@/features/integrations/config-service", () => ({
  getIntellyDteConfig: vi.fn(),
  normalizeIntellyDteBaseUrl: (value: string) => value.replace(/\/(?:api\/v1|api|v1)\/?$/, ""),
}));
vi.mock("@/features/auth/session", () => ({ requireUser: vi.fn(async () => ({ userId: "user-1", role: "operator" })) }));
vi.mock("server-only", () => ({}));

const fetchMock = vi.fn();

describe("server-side IntellyDTE RUT lookup", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://user:pass@localhost:3306/app";
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(getIntellyDteConfig).mockResolvedValue({ baseUrl: "https://dte.example", apiKey: "secret" });
    fetchMock.mockReset();
  });

  it("calls the RUT endpoint with the server-only API key", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { rut: "76123456-0", razonSocial: "Empresa SpA", autorizado: true } }), { status: 200 }));

    await expect(lookupClientRut("76.123.456-0")).resolves.toEqual({ rut: "76123456-0", razonSocial: "Empresa SpA", autorizado: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://dte.example/api/v1/rut/76123456-0",
      expect.objectContaining({ headers: expect.objectContaining({ "x-api-key": "secret" }) }),
    );
  });

  it.each(["https://dte.example", "https://dte.example/api", "https://dte.example/api/v1"])("normalizes the configured base URL: %s", async (baseUrl) => {
    vi.mocked(getIntellyDteConfig).mockResolvedValue({ baseUrl, apiKey: "secret" });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { rut: "76123456-0", razonSocial: null, autorizado: null } }), { status: 200 }));

    await lookupClientRut("76.123.456-0");

    expect(fetchMock).toHaveBeenCalledWith("https://dte.example/api/v1/rut/76123456-0", expect.any(Object));
  });

  it("turns invalid and unavailable upstream responses into safe Spanish errors", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: "secret upstream detail" }), { status: 400 }));
    await expect(lookupClientRut("76.123.456-0")).rejects.toThrow(/RUT/);

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: "secret upstream detail" }), { status: 502 }));
    const response = await GET(new Request("http://localhost/api/clients/rut/76.123.456-0"), { params: Promise.resolve({ rut: "76.123.456-0" }) });
    const body = await response.text();
    expect(response.status).toBe(502);
    expect(body).toMatch(/IntellyDTE|disponible|conectar/i);
    expect(body).not.toContain("secret upstream detail");
    expect(body).not.toContain("secret");
  });

  it("returns the successful route contract without exposing provider credentials", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { rut: "76123456-0", razonSocial: "Empresa SpA", autorizado: true } }), { status: 200 }));

    const response = await GET(new Request("http://localhost/api/clients/rut/76.123.456-0"), { params: Promise.resolve({ rut: "76.123.456-0" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: { rut: "76123456-0", razonSocial: "Empresa SpA", autorizado: true } });
  });
});
