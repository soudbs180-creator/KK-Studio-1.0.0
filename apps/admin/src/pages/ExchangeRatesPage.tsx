import { useEffect, useState } from 'react';

import type { CreditExchangeRateDto } from '../../../../packages/contracts/src/index.ts';
import { createEditableExchangeRateRows, toUpsertCreditExchangeRateInput } from '../features/exchange-rates/exchangeRatesModel.ts';
import { createAdminApiClient } from '../services/adminApiClient';

const client = createAdminApiClient();

export default function ExchangeRatesPage() {
  const [rows, setRows] = useState<CreditExchangeRateDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void client.listCreditExchangeRates().then((response) => {
      if (!response.success) {
        setError(response.error?.message || 'Failed to load exchange rates.');
        return;
      }

      setRows(createEditableExchangeRateRows(response.data.items));
    });
  }, []);

  async function handleSave(row: CreditExchangeRateDto) {
    const response = await client.upsertCreditExchangeRate(toUpsertCreditExchangeRateInput(row));
    if (!response.success) {
      setError(response.error?.message || 'Failed to save exchange rate.');
      return;
    }

    setRows((current) => current.map((candidate) => (
      candidate.currencyCode === response.data.currencyCode ? response.data : candidate
    )));
  }

  return (
    <section>
      <h1>Exchange Rates</h1>
      {error ? <p>{error}</p> : null}
      {rows.map((row) => (
        <article key={row.currencyCode}>
          <strong>{row.currencyCode}</strong>
          <span>{row.creditsPerUnit}</span>
          <button type="button" onClick={() => void handleSave(row)}>Save</button>
        </article>
      ))}
    </section>
  );
}
