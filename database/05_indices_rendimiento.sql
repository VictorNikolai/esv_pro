-- Índices para optimizar la paginación y filtrado de órdenes de trabajo
CREATE INDEX IF NOT EXISTS idx_work_orders_updated_at ON work_orders(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_orders_created_by ON work_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
