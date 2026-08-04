-- Migration 0007: drop notes
-- The notes vertical slice was the template's reference sample and is not part
-- of the product; its server/client code is removed, so drop the table (its
-- indexes drop with it).

DROP TABLE IF EXISTS notes;
