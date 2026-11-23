<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

/**
 * Store checkout. Everything happens in ONE database transaction.
 *
 * Lock order (shared with UserDeletionService and InvoiceService, never reversed):
 *   users -> products (ascending id) -> orders / invoices -> transactions
 *
 * The client never sends prices or totals: they are computed here from the
 * locked product rows, in integer cents.
 */
class CheckoutService
{
    /**
     * @param  array<int, array{product_id:int, quantity:int}>  $items
     */
    public function checkout(User $buyer, array $items, string $paymentOption): Order
    {
        // Merge duplicate products and sort by id so locks are always taken in ascending order.
        $quantities = [];
        foreach ($items as $item) {
            $id = (int) $item['product_id'];
            $quantities[$id] = ($quantities[$id] ?? 0) + (int) $item['quantity'];
        }
        ksort($quantities);

        return DB::transaction(function () use ($buyer, $quantities, $paymentOption) {
            // 1. Lock the buyer row first (same row UserDeletionService locks).
            $user = User::whereKey($buyer->id)->lockForUpdate()->first();

            if (! $user) {
                throw new ApiException('Unauthenticated.', 401);
            }

            // 2. Lock the products in ascending id order.
            $products = Product::whereIn('id', array_keys($quantities))
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $totalCents = 0;
            $lines = [];

            foreach ($quantities as $productId => $quantity) {
                $product = $products->get($productId);

                if (! $product) {
                    throw new ApiException('One of the products in your cart no longer exists.', 422, 'product_not_found');
                }

                // Milestone 1 message.
                if ($product->stock < $quantity) {
                    throw new ApiException("Not enough stock available for {$product->name}.", 422, 'insufficient_stock');
                }

                $unitCents = Money::toCents($product->price);
                $totalCents += $unitCents * $quantity;
                $lines[] = [$product, $quantity, Money::fromCents($unitCents)];
            }

            $total = Money::fromCents($totalCents);

            // 3. Order + immutable item snapshots + stock decrement.
            $order = Order::create([
                'user_id' => $user->id,
                'total' => $total,
                'payment_option' => $paymentOption,
            ]);

            foreach ($lines as [$product, $quantity, $unitPrice]) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                ]);

                $product->decrement('stock', $quantity);
            }

            // 4. Exactly ONE financial record per order.
            if ($paymentOption === Order::PAY_NOW) {
                // Simulated immediate payment: store income, no invoice (Milestone 1).
                $transaction = new Transaction([
                    'department' => 'Bookstore',
                    'type' => 'income',
                    'amount' => $total,
                    'date' => now()->toDateString(),
                    'description' => 'Campus store purchase',
                ]);
                $transaction->order_id = $order->id;
                $transaction->save();
            } else {
                // Pay later: unpaid invoice. Income is recorded only when it is paid.
                $invoice = new Invoice([
                    'student_id' => $user->id,
                    'description' => 'Campus store purchase',
                    'amount' => $total,
                    'issue_date' => now()->toDateString(),
                    'due_date' => now()->addDays(30)->toDateString(),
                ]);
                $invoice->order_id = $order->id;
                $invoice->status = Invoice::UNPAID;
                $invoice->save();
            }

            return $order->load(['items.product', 'invoice', 'transaction']);
        }, 3);
    }
}
