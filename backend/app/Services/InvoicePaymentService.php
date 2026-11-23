<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Order;
use App\Models\Transaction;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Marks an invoice as paid and, for store purchases, records the Bookstore
 * income exactly once.
 *
 * Duplicate protection (three independent layers):
 *   1. the invoice row is locked, so a concurrent request waits and then sees "paid";
 *   2. we check whether income already exists for the order;
 *   3. transactions.order_id is UNIQUE, so the database rejects a second row.
 */
class InvoicePaymentService
{
    /**
     * @return array{0: Invoice, 1: bool} the invoice and whether this call actually paid it
     */
    public function pay(Invoice $invoice): array
    {
        return DB::transaction(function () use ($invoice) {
            $locked = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            // Milestone 1: paying an already-paid invoice does nothing.
            if ($locked->isPaid()) {
                return [$locked, false];
            }

            $locked->status = Invoice::PAID;
            $locked->paid_at = now();
            $locked->save();

            // Manual invoices (no order) create no income, exactly like Milestone 1.
            if ($locked->order_id !== null) {
                $this->recordStoreIncome($locked);
            }

            return [$locked, true];
        }, 3);
    }

    private function recordStoreIncome(Invoice $invoice): void
    {
        if (Transaction::where('order_id', $invoice->order_id)->exists()) {
            return;
        }

        $order = Order::findOrFail($invoice->order_id);

        $transaction = new Transaction([
            'department' => 'Bookstore',
            'type' => 'income',
            'amount' => $order->total,
            'date' => now()->toDateString(),
            'description' => "Campus store purchase - Invoice #{$invoice->id}",
        ]);
        $transaction->order_id = $order->id;

        try {
            $transaction->save();
        } catch (UniqueConstraintViolationException) {
            // Income for this order already exists: nothing to do.
        }
    }
}
