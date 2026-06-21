import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRightLeft, CircleDollarSign, ExternalLink, Loader2, PartyPopper, PencilLine, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Debt = {
  id: number;
  debtor: string;
  creditor: string;
  amount: number;
  note: string | null;
  settled: number;
  createdAt: string;
};

type DebtForm = {
  debtor: string;
  creditor: string;
  amount: string;
  note: string;
};

type NameResponse = {
  names: string[];
};

type Stats = {
  totalCount: number;
  openCount: number;
  settledCount: number;
  openAmount: number;
  settledAmount: number;
};

type SettlementStep = {
  payer: string;
  payee: string;
  amount: number;
};

type Mode = 'create' | 'edit';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? '';

const initialForm: DebtForm = {
  debtor: '',
  creditor: '',
  amount: '',
  note: ''
};

function apiUrl(path: string) {
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
}

export function App() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [form, setForm] = useState<DebtForm>(initialForm);
  const [mode, setMode] = useState<Mode>('create');
  const [editingDebtId, setEditingDebtId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDebts = useMemo(() => debts.filter((debt) => debt.settled === 0), [debts]);
  const settledDebts = useMemo(() => debts.filter((debt) => debt.settled === 1), [debts]);
  const settlementSteps = useMemo(() => buildSettlementSteps(openDebts), [openDebts]);
  const stats = useMemo<Stats>(
    () => ({
      totalCount: debts.length,
      openCount: openDebts.length,
      settledCount: settledDebts.length,
      openAmount: openDebts.reduce((total, debt) => total + debt.amount, 0),
      settledAmount: settledDebts.reduce((total, debt) => total + debt.amount, 0)
    }),
    [debts, openDebts, settledDebts]
  );

  useEffect(() => {
    void loadNames();
    void loadDebts(search);
  }, [search]);

  async function loadNames() {
    try {
      const response = await fetch(apiUrl('/api/debts/names'));
      const data = (await response.json()) as NameResponse;
      setNames(data.names);
    } catch {
      // Convenience only.
    }
  }

  async function loadDebts(query = search) {
    setLoading(true);
    setError(null);

    try {
      const url = query.trim() ? apiUrl(`/api/debts?q=${encodeURIComponent(query.trim())}`) : apiUrl('/api/debts');
      const response = await fetch(url);
      const data = (await response.json()) as { debts: Debt[] };
      setDebts(data.debts);
    } catch {
      setError('無法讀取資料，請確認 API 已啟動。');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(mode === 'create' ? apiUrl('/api/debts') : apiUrl(`/api/debts/${editingDebtId}`), {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debtor: form.debtor,
          creditor: form.creditor,
          amount: Number(form.amount),
          note: form.note
        })
      });

      if (!response.ok) {
        throw new Error(mode === 'create' ? '新增失敗' : '更新失敗');
      }

      resetForm();
      void loadNames();
      await loadDebts(search);
    } catch {
      setError(mode === 'create' ? '新增失敗，請確認欄位都已填好。' : '更新失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('確定要刪除這筆債務嗎？')) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(apiUrl(`/api/debts/${id}`), { method: 'DELETE' });

      if (!response.ok) {
        throw new Error('刪除失敗');
      }

      if (editingDebtId === id) {
        resetForm();
      }

      void loadNames();
      await loadDebts(search);
    } catch {
      setError('無法刪除債務。');
    }
  }

  async function markSettled(id: number) {
    setError(null);

    try {
      const response = await fetch(apiUrl(`/api/debts/${id}/settle`), { method: 'PATCH' });

      if (!response.ok) {
        throw new Error('結清失敗');
      }

      const data = (await response.json()) as { debt: Debt };
      setDebts((currentDebts) =>
        currentDebts.map((debt) =>
          debt.id === data.debt.id ? data.debt : debt
        )
      );

      void loadDebts(search);
    } catch {
      setError('無法更新債務狀態。');
    }
  }

  async function repayDebt(id: number) {
    const input = window.prompt('輸入這次還款金額');

    if (input === null) {
      return;
    }

    const repayAmount = Number(input);

    if (!Number.isInteger(repayAmount) || repayAmount <= 0) {
      setError('還款金額必須是正整數。');
      return;
    }

    setError(null);

    try {
      const response = await fetch(apiUrl(`/api/debts/${id}/repay`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: repayAmount })
      });

      if (!response.ok) {
        throw new Error('還款失敗');
      }

      void loadNames();
      await loadDebts(search);
    } catch {
      setError('無法處理還款。');
    }
  }

  async function applySettlementStep(step: SettlementStep) {
    setError(null);

    try {
      const response = await fetch(apiUrl('/api/debts/settlements/apply'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(step)
      });

      if (!response.ok) {
        throw new Error('套用結算失敗');
      }

      void loadNames();
      await loadDebts(search);
    } catch {
      setError('無法套用結算建議。');
    }
  }

  function startEdit(debt: Debt) {
    setMode('edit');
    setEditingDebtId(debt.id);
    setForm({
      debtor: debt.debtor,
      creditor: debt.creditor,
      amount: String(debt.amount),
      note: debt.note ?? ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setMode('create');
    setEditingDebtId(null);
    setForm(initialForm);
  }

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-border bg-card/80 p-6 shadow-soft backdrop-blur sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-mutedForeground">
                <PartyPopper className="h-4 w-4" />
                債務記錄網頁
              </span>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
                  誰欠誰，一眼看懂。
                </h1>
                <p className="max-w-2xl text-base leading-7 text-mutedForeground sm:text-lg">
                  用簡單的方式記錄借款、債權與結清狀態，所有資料都存在本機 SQLite，適合小團體或個人帳本使用。
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="總筆數" value={stats.totalCount} icon={<ArrowRightLeft className="h-4 w-4" />} />
                <StatCard label="未結清金額" value={`$${stats.openAmount}`} icon={<CircleDollarSign className="h-4 w-4" />} />
                <StatCard label="已結清金額" value={`$${stats.settledAmount}`} icon={<Loader2 className="h-4 w-4" />} />
              </div>
            </div>

            <Card className="border-border/70 bg-background/95">
              <CardHeader>
                <CardTitle>{mode === 'create' ? '新增一筆債務' : '編輯債務'}</CardTitle>
                <CardDescription>{mode === 'create' ? '填完後會直接寫入 SQLite。' : '修改內容後會更新現有紀錄。'}</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NameSelect
                      label="誰欠錢的人"
                      value={form.debtor}
                      names={names}
                      onChange={(value) => setForm((current) => ({ ...current, debtor: value }))}
                    />
                    <NameSelect
                      label="誰是收款的人"
                      value={form.creditor}
                      names={names}
                      onChange={(value) => setForm((current) => ({ ...current, creditor: value }))}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
                    <Input
                      type="number"
                      min="1"
                      placeholder="金額"
                      value={form.amount}
                      onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                    />
                    <Input
                      placeholder="備註，例如：晚餐、車資、代墊"
                      value={form.note}
                      onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? '儲存中...' : mode === 'create' ? '新增債務' : '更新債務'}
                  </Button>
                  {mode === 'edit' ? (
                    <Button type="button" variant="secondary" className="w-full" onClick={resetForm}>
                      取消編輯
                    </Button>
                  ) : null}
                  {error ? <p className="text-sm text-red-600">{error}</p> : null}
                </form>
              </CardContent>
            </Card>
          </div>
        </section>

        <Card className="border-border/70 bg-background/95">
          <CardHeader>
            <CardTitle>GitHub 介紹頁面</CardTitle>
            <CardDescription>查看專案說明、功能整理與最新狀態。</CardDescription>
          </CardHeader>
          <CardContent>
            <a
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primaryForeground shadow-soft transition-opacity hover:opacity-95"
              href="https://github.com/GodwhiteTaiwan/homework"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
              前往 GitHub 介紹頁面
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>搜尋</CardTitle>
            <CardDescription>可依姓名或備註篩選債務紀錄。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mutedForeground" />
              <Input
                className="pl-11"
                placeholder="輸入債務人、債權人或備註"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>結算建議</CardTitle>
            <CardDescription>最簡易的還錢方式，直接看誰要還多少錢給誰。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {settlementSteps.length === 0 ? (
              <EmptyState text="目前沒有需要結算的金額。" />
            ) : (
              settlementSteps.map((step, index) => (
                <div
                  key={`${step.payer}-${step.payee}-${index}`}
                  className="flex flex-col gap-3 rounded-3xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium">
                      {step.payer} 要還給 {step.payee}
                    </div>
                    <div className="text-sm text-mutedForeground">金額 ${step.amount}</div>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-sm text-foreground">
                    結算建議 #{index + 1}
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => void applySettlementStep(step)}>
                    套用建議並自動結清
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>未結清</CardTitle>
              <CardDescription>目前還沒結清的債務。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? <p className="text-sm text-mutedForeground">載入中...</p> : null}
              {!loading && openDebts.length === 0 ? <EmptyState text="目前沒有未結清債務。" /> : null}
              {openDebts.map((debt) => (
                <DebtRow
                  key={debt.id}
                  debt={debt}
                  onRepay={repayDebt}
                  onSettle={markSettled}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>已結清</CardTitle>
              <CardDescription>已經還完的紀錄會留在這裡。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!loading && settledDebts.length === 0 ? <EmptyState text="目前還沒有已結清紀錄。" /> : null}
              {settledDebts.map((debt) => (
                <DebtRow key={debt.id} debt={debt} settled onEdit={startEdit} onDelete={handleDelete} />
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-background/90 p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-sm text-mutedForeground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function DebtRow({
  debt,
  settled = false,
  onSettle,
  onRepay,
  onEdit,
  onDelete
}: {
  debt: Debt;
  settled?: boolean;
  onSettle?: (id: number) => Promise<void>;
  onRepay?: (id: number) => Promise<void>;
  onEdit?: (debt: Debt) => void;
  onDelete?: (id: number) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-medium">
          {debt.debtor} 欠 {debt.creditor}
        </div>
        <div className="text-sm text-mutedForeground">
          金額 ${debt.amount}
          {debt.note ? ` ・ ${debt.note}` : ''}
        </div>
      </div>
      {settled ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-emerald-700">已結清</span>
          <Button variant="ghost" size="sm" onClick={() => onEdit?.(debt)}>
            <PencilLine className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete?.(debt.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => onRepay?.(debt.id)}>
            <Plus className="h-4 w-4" />
            還錢
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onSettle?.(debt.id)}>
            標記結清
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit?.(debt)}>
            <PencilLine className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete?.(debt.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-3xl border border-dashed border-border p-6 text-sm text-mutedForeground">{text}</div>;
}

function buildSettlementSteps(debts: Debt[]): SettlementStep[] {
  const balances = new Map<string, number>();

  for (const debt of debts) {
    balances.set(debt.debtor, (balances.get(debt.debtor) ?? 0) - debt.amount);
    balances.set(debt.creditor, (balances.get(debt.creditor) ?? 0) + debt.amount);
  }

  const debtors = Array.from(balances.entries())
    .filter(([, balance]) => balance < 0)
    .map(([name, balance]) => ({ name, amount: Math.abs(balance) }));

  const creditors = Array.from(balances.entries())
    .filter(([, balance]) => balance > 0)
    .map(([name, balance]) => ({ name, amount: balance }));

  const steps: SettlementStep[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);

    steps.push({ payer: debtor.name, payee: creditor.name, amount });

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount === 0) {
      debtorIndex += 1;
    }

    if (creditor.amount === 0) {
      creditorIndex += 1;
    }
  }

  return steps;
}

function NameSelect({
  label,
  value,
  names,
  onChange
}: {
  label: string;
  value: string;
  names: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">請選擇</option>
        {names.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <Input placeholder="或直接輸入新名字" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
