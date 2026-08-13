import type { RowDataPacket } from "mysql2";
import { getPool } from "@/db";

type MetricRow = RowDataPacket & { collected: string; pending: string; orders: number; invoices: number };
type TrendRow = RowDataPacket & { label: string; total: string };

export async function getDashboardData() {
  const [metricsRows] = await getPool().query<MetricRow[]>(`SELECT
    COALESCE(SUM(CASE WHEN status IN ('paid','invoiced') THEN total ELSE 0 END),0) collected,
    COALESCE(SUM(CASE WHEN status='issued' THEN total ELSE 0 END),0) pending,
    COUNT(*) orders,
    SUM(CASE WHEN status='invoiced' THEN 1 ELSE 0 END) invoices
    FROM payment_orders WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`);
  const [trendRows] = await getPool().query<TrendRow[]>(`SELECT DATE_FORMAT(created_at,'%d %b') label,
    SUM(CASE WHEN status IN ('paid','invoiced') THEN total ELSE 0 END) total
    FROM payment_orders WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    GROUP BY DATE(created_at) ORDER BY DATE(created_at)`);
  const row = metricsRows[0] ?? { collected: "0", pending: "0", orders: 0, invoices: 0 };
  return { metrics: row, trend: trendRows.map((item) => ({ label: item.label, total: Number(item.total) })) };
}
