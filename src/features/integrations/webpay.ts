import { getDb } from "@/db";
import { integrationConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

const WEBPAY_INTEGRATION_URL = "https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.0/transactions";
const WEBPAY_PRODUCTION_URL = "https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.0/transactions";

const DEFAULT_TEST_COMMERCE_CODE = "597055555532";
const DEFAULT_TEST_API_KEY = "579B532A7440BBAB61B82D4E290C4472";

const WEBPAY_TIMEOUT_MS = 15000;

function maskCommerce(code: string): string {
  if (code.length <= 8) return `${code.slice(0, 2)}•••${code.slice(-2)}`;
  return `${code.slice(0, 4)}•••${code.slice(-4)}`;
}

function maskToken(token: string): string {
  if (!token) return "empty";
  if (token.length <= 10) return `len=${token.length} last4=${token.slice(-4)}`;
  return `len=${token.length} last6=${token.slice(-6)}`;
}

function webpayLog(scope: "webpay-create" | "webpay-commit" | "webpay-test", event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ scope, event, ...data }));
}

export type WebpayConfig = {
  commerceCode: string;
  apiKey: string;
  isProduction: boolean;
  configured: boolean;
};

export async function getWebpayConfig(): Promise<WebpayConfig> {
  const env = getEnv();

  const [row] = await getDb()
    .select()
    .from(integrationConfigs)
    .where(eq(integrationConfigs.integration, "webpay"))
    .limit(1)
    .execute();

  if (row && row.status === "active") {
    let apiKey = env.WEBPAY_API_KEY || DEFAULT_TEST_API_KEY;
    if (row.apiKeyCiphertext && row.apiKeyIv && row.apiKeyAuthTag && env.CREDENTIALS_ENCRYPTION_KEY) {
      try {
        const keyBuffer = Buffer.from(env.CREDENTIALS_ENCRYPTION_KEY, "base64");
        apiKey = decryptSecret(
          {
            ciphertext: row.apiKeyCiphertext,
            iv: row.apiKeyIv,
            authTag: row.apiKeyAuthTag,
          },
          keyBuffer
        );
      } catch {
        apiKey = env.WEBPAY_API_KEY || DEFAULT_TEST_API_KEY;
      }
    }

    const isProduction = row.baseUrl.includes("webpay3g.transbank.cl") && !row.baseUrl.includes("webpay3gint");
    return {
      commerceCode: row.tenantRut || env.WEBPAY_COMMERCE_CODE || DEFAULT_TEST_COMMERCE_CODE,
      apiKey,
      isProduction,
      configured: true,
    };
  }

  // Fallback to environment variables
  if (env.WEBPAY_COMMERCE_CODE && env.WEBPAY_API_KEY) {
    return {
      commerceCode: env.WEBPAY_COMMERCE_CODE,
      apiKey: env.WEBPAY_API_KEY,
      isProduction: env.WEBPAY_ENVIRONMENT === "production",
      configured: true,
    };
  }

  // Default testing sandbox
  return {
    commerceCode: DEFAULT_TEST_COMMERCE_CODE,
    apiKey: DEFAULT_TEST_API_KEY,
    isProduction: false,
    configured: false,
  };
}

export async function saveWebpayConfig(input: {
  commerceCode: string;
  apiKey?: string;
  environment: "integration" | "production";
  userId: string;
}): Promise<void> {
  const env = getEnv();
  const baseUrl = input.environment === "production" ? WEBPAY_PRODUCTION_URL : WEBPAY_INTEGRATION_URL;

  const [existing] = await getDb()
    .select()
    .from(integrationConfigs)
    .where(eq(integrationConfigs.integration, "webpay"))
    .limit(1)
    .execute();

  let encrypted: { ciphertext: string; iv: string; authTag: string; lastFour: string };
  if (input.apiKey?.trim()) {
    if (!env.CREDENTIALS_ENCRYPTION_KEY) {
      throw new AppError("ENCRYPTION_NOT_CONFIGURED", "Configura CREDENTIALS_ENCRYPTION_KEY para cifrar la API Key de WebPay.");
    }
    const keyBuffer = Buffer.from(env.CREDENTIALS_ENCRYPTION_KEY, "base64");
    const result = encryptSecret(input.apiKey.trim(), keyBuffer);
    encrypted = { ...result, lastFour: input.apiKey.trim().slice(-4) };
  } else if (existing?.apiKeyCiphertext && existing.apiKeyIv && existing.apiKeyAuthTag) {
    encrypted = {
      ciphertext: existing.apiKeyCiphertext,
      iv: existing.apiKeyIv,
      authTag: existing.apiKeyAuthTag,
      lastFour: existing.apiKeyLastFour ?? "••••",
    };
  } else {
    throw new AppError("API_KEY_REQUIRED", "Ingresa la API Key de Transbank WebPay.");
  }

  const set = {
    baseUrl,
    tenantRut: input.commerceCode.trim(),
    apiKeyCiphertext: encrypted.ciphertext,
    apiKeyIv: encrypted.iv,
    apiKeyAuthTag: encrypted.authTag,
    apiKeyLastFour: encrypted.lastFour,
    status: "active" as const,
    updatedBy: input.userId,
    updatedAt: new Date(),
  };

  await getDb()
    .insert(integrationConfigs)
    .values({ id: existing?.id ?? randomUUID(), integration: "webpay", ...set })
    .onDuplicateKeyUpdate({ set });
}

export type WebpayCreateResult = {
  token: string;
  url: string;
};

export type WebpayCommitResult = {
  vci?: string;
  amount: number;
  status: string;
  buyOrder: string;
  sessionId: string;
  cardDetail?: { cardNumber?: string };
  accountingDate?: string;
  transactionDate?: string;
  authorizationCode?: string;
  paymentTypeCode?: string;
  responseCode: number;
  installmentsAmount?: number;
  installmentsNumber?: number;
  balance?: number;
};

export async function createWebpayTransaction(input: {
  buyOrder: string;
  sessionId: string;
  amount: number;
  returnUrl: string;
}): Promise<WebpayCreateResult> {
  const t0 = Date.now();
  const config = await getWebpayConfig();
  const endpoint = config.isProduction ? WEBPAY_PRODUCTION_URL : WEBPAY_INTEGRATION_URL;
  let returnOrigin = "";
  let returnHasToken = false;
  try {
    const parsed = new URL(input.returnUrl);
    returnOrigin = parsed.origin;
    returnHasToken = parsed.searchParams.has("token");
  } catch {
    returnOrigin = "unparseable";
  }
  const roundedAmount = Math.round(input.amount);
  webpayLog("webpay-create", "start", {
    buyOrder: input.buyOrder,
    amount: roundedAmount,
    returnOrigin,
    returnHasToken,
    isProduction: config.isProduction,
    endpointHost: new URL(endpoint).host,
    commerce: maskCommerce(config.commerceCode),
    configured: config.configured,
  });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Tbk-Api-Key-Id": config.commerceCode,
        "Tbk-Api-Key-Secret": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        buy_order: input.buyOrder,
        session_id: input.sessionId,
        amount: roundedAmount,
        return_url: input.returnUrl,
      }),
      signal: AbortSignal.timeout(WEBPAY_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      webpayLog("webpay-create", "http-error", {
        buyOrder: input.buyOrder,
        httpStatus: response.status,
        bodyTruncated: errorText.slice(0, 500),
        elapsedMs: Date.now() - t0,
      });
      throw new AppError("WEBPAY_CREATION_FAILED", `Error de Transbank WebPay: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as { token: string; url: string };
    webpayLog("webpay-create", "ok", {
      buyOrder: input.buyOrder,
      token: maskToken(data.token),
      urlHost: (() => { try { return new URL(data.url).host; } catch { return "unparseable"; } })(),
      elapsedMs: Date.now() - t0,
    });
    return {
      token: data.token,
      url: data.url,
    };
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      webpayLog("webpay-create", "timeout", { buyOrder: input.buyOrder, timeoutMs: WEBPAY_TIMEOUT_MS, elapsedMs: Date.now() - t0 });
      throw new AppError("WEBPAY_TIMEOUT", `Transbank no respondió en ${WEBPAY_TIMEOUT_MS / 1000}s al crear la transacción.`);
    }
    throw error;
  }
}

export async function commitWebpayTransaction(token: string): Promise<WebpayCommitResult> {
  const t0 = Date.now();
  const config = await getWebpayConfig();
  const endpoint = `${config.isProduction ? WEBPAY_PRODUCTION_URL : WEBPAY_INTEGRATION_URL}/${token}`;
  webpayLog("webpay-commit", "start", {
    token: maskToken(token),
    isProduction: config.isProduction,
    endpointHost: config.isProduction ? new URL(WEBPAY_PRODUCTION_URL).host : new URL(WEBPAY_INTEGRATION_URL).host,
    commerce: maskCommerce(config.commerceCode),
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "PUT",
      headers: {
        "Tbk-Api-Key-Id": config.commerceCode,
        "Tbk-Api-Key-Secret": config.apiKey,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(WEBPAY_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      webpayLog("webpay-commit", "timeout", { token: maskToken(token), timeoutMs: WEBPAY_TIMEOUT_MS, elapsedMs: Date.now() - t0 });
      throw new AppError("WEBPAY_TIMEOUT", `Transbank no respondió en ${WEBPAY_TIMEOUT_MS / 1000}s al confirmar la transacción.`);
    }
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text();
    webpayLog("webpay-commit", "http-error", {
      token: maskToken(token),
      httpStatus: response.status,
      bodyTruncated: errorText.slice(0, 500),
      elapsedMs: Date.now() - t0,
    });
    throw new AppError("WEBPAY_COMMIT_FAILED", `Error al confirmar transacción WebPay: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as {
    vci?: string;
    amount: number;
    status: string;
    buy_order: string;
    session_id: string;
    card_detail?: { card_number?: string };
    accounting_date?: string;
    transaction_date?: string;
    authorization_code?: string;
    payment_type_code?: string;
    response_code: number;
    installments_amount?: number;
    installments_number?: number;
    balance?: number;
  };

  webpayLog("webpay-commit", "ok", {
    token: maskToken(token),
    responseCode: data.response_code,
    status: data.status,
    amount: data.amount,
    buyOrder: data.buy_order,
    elapsedMs: Date.now() - t0,
  });

  return {
    vci: data.vci,
    amount: data.amount,
    status: data.status,
    buyOrder: data.buy_order,
    sessionId: data.session_id,
    cardDetail: { cardNumber: data.card_detail?.card_number },
    accountingDate: data.accounting_date,
    transactionDate: data.transaction_date,
    authorizationCode: data.authorization_code,
    paymentTypeCode: data.payment_type_code,
    responseCode: data.response_code,
    installmentsAmount: data.installments_amount,
    installmentsNumber: data.installments_number,
    balance: data.balance,
  };
}

export async function testWebpayConnection(): Promise<{ ok: boolean; safeMessage: string }> {
  try {
    const config = await getWebpayConfig();
    const endpoint = config.isProduction ? WEBPAY_PRODUCTION_URL : WEBPAY_INTEGRATION_URL;
    const testBuyOrder = `test-${Date.now()}`.slice(0, 26);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Tbk-Api-Key-Id": config.commerceCode,
        "Tbk-Api-Key-Secret": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        buy_order: testBuyOrder,
        session_id: "test-session",
        amount: 1000,
        return_url: "https://gestion.intelly.cl/api/webpay/return",
      }),
      signal: AbortSignal.timeout(WEBPAY_TIMEOUT_MS),
    });

    if (response.ok) {
      return {
        ok: true,
        safeMessage: `WebPay Plus conectado correctamente (${config.isProduction ? "Producción" : "Ambiente de Integración/Pruebas"}) con código ${config.commerceCode}`,
      };
    }
    return {
      ok: false,
      safeMessage: `Transbank respondió con código HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      safeMessage: error instanceof Error ? error.message : "No fue posible conectar con Transbank WebPay.",
    };
  }
}
