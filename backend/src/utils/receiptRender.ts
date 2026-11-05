import { escapeHtml as e } from './sharePage';
import { formatGhs } from './billing';

type ReceiptPayment = {
  receiptNumber: string | null;
  reference: string;
  productName: string;
  subtotalPesewas: number;
  vatPesewas: number;
  totalPesewas: number;
  vatRateBps: number;
  refundedPesewas: number;
  channel: string | null;
  paidAt: Date | null;
  billToName: string | null;
  billToEmail: string | null;
};

type ReceiptSettings = {
  companyName: string;
  companyAddress: string;
  companyTin: string;
  companyEmail: string;
  companyPhone: string;
  receiptFooter: string;
};

const CHANNEL: Record<string, string> = { card: 'Card', mobile_money: 'Mobile money', bank: 'Bank', ussd: 'USSD', bank_transfer: 'Bank transfer' };

/** A receipt people can keep: who was paid, what for, the VAT, and the total. A plain page that prints cleanly (or saves as PDF). */
export const renderReceiptHtml = (payment: ReceiptPayment, settings: ReceiptSettings) => {
  const date = payment.paidAt ? payment.paidAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const rate = payment.vatRateBps / 100;
  const company = [settings.companyAddress, settings.companyTin ? `TIN: ${settings.companyTin}` : '', settings.companyEmail, settings.companyPhone].filter(Boolean);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Receipt ${e(payment.receiptNumber ?? payment.reference)}</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111c2d; margin: 0; padding: 32px; background: #f4f7fb; }
  .sheet { max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #dde3ec; border-radius: 12px; padding: 40px; }
  h1 { margin: 0 0 4px; font-size: 24px; }
  .muted { color: #536275; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th, td { text-align: left; padding: 10px 0; border-bottom: 1px solid #e8eef5; font-size: 15px; }
  td.n, th.n { text-align: right; }
  .total td { font-weight: 800; font-size: 17px; border-bottom: 0; }
  .meta { display: flex; justify-content: space-between; gap: 24px; margin-top: 24px; flex-wrap: wrap; }
  .meta p { margin: 0 0 4px; font-size: 14px; }
  @media print { body { background: #fff; padding: 0; } .sheet { border: 0; } }
</style>
</head>
<body>
<div class="sheet">
  <h1>${e(settings.companyName)}</h1>
  ${company.map((line) => `<div class="muted">${e(line)}</div>`).join('\n  ')}

  <div class="meta">
    <div>
      <p><strong>Receipt</strong> ${e(payment.receiptNumber ?? '')}</p>
      <p><strong>Date</strong> ${e(date)}</p>
      <p><strong>Payment reference</strong> ${e(payment.reference)}</p>
      ${payment.channel ? `<p><strong>Paid by</strong> ${e(CHANNEL[payment.channel] ?? payment.channel)}</p>` : ''}
    </div>
    <div>
      <p><strong>Billed to</strong></p>
      ${payment.billToName ? `<p>${e(payment.billToName)}</p>` : ''}
      ${payment.billToEmail ? `<p>${e(payment.billToEmail)}</p>` : ''}
    </div>
  </div>

  <table>
    <thead><tr><th>Item</th><th class="n">Amount</th></tr></thead>
    <tbody>
      <tr><td>${e(payment.productName)}</td><td class="n">${e(formatGhs(payment.subtotalPesewas))}</td></tr>
      <tr><td>VAT (${e(String(rate))}%)</td><td class="n">${e(formatGhs(payment.vatPesewas))}</td></tr>
      <tr class="total"><td>Total paid</td><td class="n">${e(formatGhs(payment.totalPesewas))}</td></tr>
      ${payment.refundedPesewas > 0 ? `<tr><td>Refunded</td><td class="n">-${e(formatGhs(payment.refundedPesewas))}</td></tr>` : ''}
    </tbody>
  </table>

  <p class="muted" style="margin-top:32px">${e(settings.receiptFooter)}</p>
</div>
</body>
</html>`;
};
