import { getDb } from "@/db";
import { integrationConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decryptSecret } from "@/lib/encryption";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

const WEBPAY_INTEGRATION_URL = "https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.0/transactions";
const WEBPAY_PRODUCTION_URL = "https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.0/transactions";

const DEFAULT_TEST_COMMERCE_CODE = "597055555532";
const DEFAULT_TEST_API_KEY = "579B532A7440BBAB61B82D4E290C4472";

export type WebpayConfig = {
  commerceCode: string;
  apiKey: string;
  isProduction: boolean;
  configured: boolean;
};

export async function getWebpayConfig(): Promise<WebpayConfig> {
  const [row] = await getDb()
    .select()
    .from(integrationConfigs)
    .where(eq(integrationConfigs.integration, "webpay"))
    .limit(1)
    .execute();

  if (!row) {
    return {
      commerceCode: DEFAULT_TEST_COMMERCE_CODE,
      apiKey: DEFAULT_TEST_API_KEY,
      isProduction: false,
      configured: false,
    };
  }

  let apiKey = DEFAULT_TEST_API_KEY;
  const env = getEnv();
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
      apiKey = DEFAULT_TEST_API_KEY;
    }
  }

  const isProduction = row.baseUrl.includes("webpay3g.transbank.cl") && !row.baseUrl.includes("webpay3gint");
  return {
    commerceCode: row.tenantRut || DEFAULT_TEST_COMMERCE_CODE,
    apiKey,
    isProduction,
    configured: true,
  };
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
  const config = await getWebpayConfig();
  const endpoint = config.isProduction ? WEBPAY_PRODUCTION_URL : WEBPAY_INTEGRATION_URL;

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
      amount: Math.round(input.amount),
      return_url: input.returnUrl,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AppError("WEBPAY_CREATION_FAILED", `Error de Transbank WebPay: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as { token: string; url: string };
  return {
    token: data.token,
    url: data.url,
  };
}

export async function commitWebpayTransaction(token: string): Promise<WebpayCommitResult> {
  const config = await getWebpayConfig();
  const endpoint = `${config.isProduction ? WEBPAY_PRODUCTION_URL : WEBPAY_INTEGRATION_URL}/${token}`;

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      "Tbk-Api-Key-Id": config.commerceCode,
      "Tbk-Api-Key-Secret": config.apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
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
    });

    if (response.ok) {
      return {
        ok: true,
        safeMessage: `WebPay Plus conectado correctamente (${config.isProduction ? "Producción" : "Ambiente de Integración"}) con código ${config.commerceCode}`,
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
