import { Router } from 'express';
import { z } from 'zod';
import { database } from '../db.js';

const debtInputSchema = z.object({
  debtor: z.string().trim().min(1),
  creditor: z.string().trim().min(1),
  amount: z.number().int().positive(),
  note: z.string().trim().max(200).optional().or(z.literal(''))
});

const debtIdSchema = z.object({
  id: z.coerce.number().int().positive()
});

const repaymentSchema = z.object({
  amount: z.coerce.number().int().positive()
});

const settlementSuggestionSchema = z.object({
  payer: z.string().trim().min(1),
  payee: z.string().trim().min(1),
  amount: z.coerce.number().int().positive()
});

type DebtRow = {
  id: number;
  amount: number;
  settled: number;
};

export const debtsRouter = Router();

function getDebtById(id: number) {
  return database
    .prepare(
      `
        SELECT id, debtor, creditor, amount, note, settled, created_at AS createdAt
        FROM debts
        WHERE id = ?
      `
    )
    .get(id);
}

function applyRepaymentToDebt(id: number, amount: number) {
  const currentDebt = getDebtById(id) as DebtRow | undefined;

  if (!currentDebt) {
    return { status: 404, message: '找不到債務資料' };
  }

  if (currentDebt.settled === 1) {
    return { status: 400, message: '這筆債務已結清' };
  }

  if (amount > currentDebt.amount) {
    return { status: 400, message: '還款金額不可大於剩餘金額' };
  }

  const remainingAmount = currentDebt.amount - amount;

  database
    .prepare(
      `
        UPDATE debts
        SET amount = ?, settled = ?
        WHERE id = ?
      `
    )
    .run(remainingAmount, remainingAmount === 0 ? 1 : 0, id);

  return { debt: getDebtById(id) };
}

debtsRouter.get('/', (request, response) => {
  const search = typeof request.query.q === 'string' ? request.query.q.trim() : '';
  const searchPattern = search ? `%${search}%` : null;

  const debts = searchPattern
    ? database
        .prepare(
          `
            SELECT id, debtor, creditor, amount, note, settled, created_at AS createdAt
            FROM debts
            WHERE debtor LIKE ? OR creditor LIKE ? OR COALESCE(note, '') LIKE ?
            ORDER BY datetime(created_at) DESC, id DESC
          `
        )
        .all(searchPattern, searchPattern, searchPattern)
    : database
        .prepare(
          `
            SELECT id, debtor, creditor, amount, note, settled, created_at AS createdAt
            FROM debts
            ORDER BY datetime(created_at) DESC, id DESC
          `
        )
        .all();

  response.json({ debts });
});

debtsRouter.get('/names', (_request, response) => {
  const rows = database
    .prepare(
      `
        SELECT DISTINCT name
        FROM (
          SELECT debtor AS name FROM debts
          UNION
          SELECT creditor AS name FROM debts
        )
        WHERE name IS NOT NULL AND trim(name) != ''
        ORDER BY name COLLATE NOCASE
      `
    )
    .all() as Array<{ name: string }>;

  const names = rows.map((row) => row.name);

  response.json({ names });
});

debtsRouter.post('/', (request, response) => {
  const parsed = debtInputSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({ message: '資料格式不正確', issues: parsed.error.flatten() });
  }

  const { debtor, creditor, amount, note } = parsed.data;
  const result = database
    .prepare(
      `
        INSERT INTO debts (debtor, creditor, amount, note)
        VALUES (?, ?, ?, ?)
      `
    )
    .run(debtor, creditor, amount, note?.trim() || null);

  const debt = getDebtById(Number(result.lastInsertRowid));

  response.status(201).json({ debt });
});

debtsRouter.patch('/:id', (request, response) => {
  const idResult = debtIdSchema.safeParse(request.params);

  if (!idResult.success) {
    return response.status(400).json({ message: 'ID 不正確' });
  }

  const parsed = debtInputSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({ message: '資料格式不正確', issues: parsed.error.flatten() });
  }

  const { debtor, creditor, amount, note } = parsed.data;
  const result = database
    .prepare(
      `
        UPDATE debts
        SET debtor = ?, creditor = ?, amount = ?, note = ?
        WHERE id = ?
      `
    )
    .run(debtor, creditor, amount, note?.trim() || null, idResult.data.id);

  if (result.changes === 0) {
    return response.status(404).json({ message: '找不到債務資料' });
  }

  const debt = getDebtById(idResult.data.id);

  response.json({ debt });
});

debtsRouter.delete('/:id', (request, response) => {
  const idResult = debtIdSchema.safeParse(request.params);

  if (!idResult.success) {
    return response.status(400).json({ message: 'ID 不正確' });
  }

  const result = database.prepare('DELETE FROM debts WHERE id = ?').run(idResult.data.id);

  if (result.changes === 0) {
    return response.status(404).json({ message: '找不到債務資料' });
  }

  response.status(204).send();
});

debtsRouter.patch('/:id/settle', (request, response) => {
  const idResult = debtIdSchema.safeParse(request.params);

  if (!idResult.success) {
    return response.status(400).json({ message: 'ID 不正確' });
  }

  const debt = getDebtById(idResult.data.id) as DebtRow | undefined;

  if (!debt) {
    return response.status(404).json({ message: '找不到債務資料' });
  }

  if (debt.settled === 1) {
    return response.status(400).json({ message: '這筆債務已結清' });
  }

  database.prepare('UPDATE debts SET settled = 1, amount = 0 WHERE id = ?').run(idResult.data.id);

  const updatedDebt = getDebtById(idResult.data.id);

  response.json({ debt: updatedDebt });
});

debtsRouter.post('/settlements/apply', (request, response) => {
  const parsed = settlementSuggestionSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({ message: '結算建議資料不正確', issues: parsed.error.flatten() });
  }

  const matchingDebts = database
    .prepare(
      `
        SELECT id, amount, settled
        FROM debts
        WHERE settled = 0 AND debtor = ? AND creditor = ?
        ORDER BY datetime(created_at) ASC, id ASC
      `
    )
    .all(parsed.data.payer, parsed.data.payee) as DebtRow[];

  if (matchingDebts.length === 0) {
    return response.status(404).json({ message: '找不到可套用的對應債務' });
  }

  let remainingAmount = parsed.data.amount;

  for (const debt of matchingDebts) {
    if (remainingAmount <= 0) {
      break;
    }

    const repayAmount = Math.min(debt.amount, remainingAmount);
    const result = applyRepaymentToDebt(debt.id, repayAmount);

    if ('status' in result && result.status !== undefined) {
      return response.status(result.status).json({ message: result.message });
    }

    remainingAmount -= repayAmount;
  }

  if (remainingAmount > 0) {
    return response.status(400).json({ message: '對應債務金額不足，無法完全套用建議結算' });
  }

  response.json({ ok: true });
});

debtsRouter.patch('/:id/repay', (request, response) => {
  const idResult = debtIdSchema.safeParse(request.params);

  if (!idResult.success) {
    return response.status(400).json({ message: 'ID 不正確' });
  }

  const parsed = repaymentSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({ message: '還款金額不正確', issues: parsed.error.flatten() });
  }

  const currentDebt = getDebtById(idResult.data.id) as { amount: number; settled: number } | undefined;

  if (!currentDebt) {
    return response.status(404).json({ message: '找不到債務資料' });
  }

  if (currentDebt.settled === 1) {
    return response.status(400).json({ message: '這筆債務已結清' });
  }

  if (parsed.data.amount > currentDebt.amount) {
    return response.status(400).json({ message: '還款金額不可大於剩餘金額' });
  }

  const remainingAmount = currentDebt.amount - parsed.data.amount;

  database
    .prepare(
      `
        UPDATE debts
        SET amount = ?, settled = ?
        WHERE id = ?
      `
    )
    .run(remainingAmount, remainingAmount === 0 ? 1 : 0, idResult.data.id);

  const debt = getDebtById(idResult.data.id);

  response.json({ debt });
});
