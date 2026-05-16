-- Migration 073: View thống kê bán hàng theo sản phẩm (#6)

CREATE OR REPLACE VIEW product_sales_stats AS
SELECT
  p.id                                                      AS product_id,
  p.ten_sp,
  p.ma_sp,
  p.gia_niem_yet,
  COUNT(DISTINCT qi.id)                                     AS so_lan_bao_gia,
  COUNT(DISTINCT CASE WHEN o.id IS NOT NULL THEN qi.id END) AS so_lan_chot,
  COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN qi.don_gia * qi.so_luong END), 0) AS doanh_thu,
  COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN qi.so_luong END), 0)              AS so_luong_ban,
  ROUND(
    CASE WHEN COUNT(DISTINCT qi.id) > 0
      THEN COUNT(DISTINCT CASE WHEN o.id IS NOT NULL THEN qi.id END) * 100.0 / COUNT(DISTINCT qi.id)
      ELSE 0
    END, 1
  )                                                         AS ty_le_chot_pct,
  CASE WHEN SUM(CASE WHEN o.id IS NOT NULL THEN qi.so_luong END) > 0
    THEN ROUND(SUM(CASE WHEN o.id IS NOT NULL THEN qi.don_gia * qi.so_luong END)::numeric
               / SUM(CASE WHEN o.id IS NOT NULL THEN qi.so_luong END), 0)
    ELSE 0
  END                                                       AS gia_ban_tb
FROM products p
LEFT JOIN quote_items qi ON qi.product_id = p.id
LEFT JOIN quotes q       ON q.id = qi.quote_id
LEFT JOIN orders o       ON o.quote_id = q.id
GROUP BY p.id, p.ten_sp, p.ma_sp, p.gia_niem_yet;

-- RLS không áp dụng trực tiếp cho view; access controlled qua API
