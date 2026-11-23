<?php

namespace Tests\Feature;

use App\Exceptions\ApiException;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Product;
use App\Models\Transaction;
use App\Services\CheckoutService;
use Tests\ApiTestCase;

class CheckoutTest extends ApiTestCase
{
    private function checkout($user, array $items, string $option = 'pay-now')
    {
        return $this->actingAs($user)->postJson('/api/checkout', ['items' => $items, 'paymentOption' => $option]);
    }

    public function test_pay_now_records_income_once_and_no_invoice(): void
    {
        $student = $this->student();
        $book = $this->product(['price' => '19.99', 'stock' => 10]);
        $pen = $this->product(['price' => '5.50', 'stock' => 4]);

        $response = $this->checkout($student, [
            ['productId' => $book->id, 'quantity' => 3],
            ['productId' => $pen->id, 'quantity' => 2],
        ])->assertCreated()
            ->assertJsonPath('data.total', 70.97) // 59.97 + 11.00, exact (integer cents)
            ->assertJsonPath('data.paymentOption', 'pay-now');

        $this->assertSame(1, Transaction::count());
        $income = Transaction::firstOrFail();
        $this->assertSame('income', $income->type);
        $this->assertSame('Bookstore', $income->department);
        $this->assertSame('70.97', $income->amount);
        $this->assertSame($response->json('data.id'), $income->order_id);
        $this->assertSame(0, Invoice::count());

        $this->assertSame(7, $book->fresh()->stock);
        $this->assertSame(2, $pen->fresh()->stock);
        $this->assertSame('Payment successful! Your purchase total is EGP 70.97.', $response->json('message'));
    }

    public function test_the_client_cannot_influence_prices_or_totals(): void
    {
        $student = $this->student();
        $product = $this->product(['price' => '100.00']);

        $this->actingAs($student)->postJson('/api/checkout', [
            'items' => [['productId' => $product->id, 'quantity' => 2, 'price' => 1, 'unitPrice' => 1]],
            'paymentOption' => 'pay-now',
            'total' => 1,
        ])->assertCreated()->assertJsonPath('data.total', 200);

        $this->assertSame('200.00', Order::firstOrFail()->total);
        $this->assertSame('200.00', Transaction::firstOrFail()->amount);
    }

    public function test_pay_later_creates_an_unpaid_invoice_and_income_only_once_it_is_paid(): void
    {
        $student = $this->student();
        $product = $this->product(['price' => '450.00']);

        $response = $this->checkout($student, [['productId' => $product->id, 'quantity' => 2]], 'add-to-invoice')
            ->assertCreated()->assertJsonPath('data.paymentOption', 'add-to-invoice');

        $this->assertSame(0, Transaction::count(), 'no income before the invoice is paid');
        $invoice = Invoice::firstOrFail();
        $this->assertSame('unpaid', $invoice->status);
        $this->assertSame('900.00', $invoice->amount);
        $this->assertSame($student->id, $invoice->student_id);
        $this->assertSame($response->json('data.id'), $invoice->order_id);

        // pay it, then pay it again: exactly one income record
        $this->actingAs($student)->postJson("/api/invoices/{$invoice->id}/pay")->assertOk();
        $this->actingAs($student)->postJson("/api/invoices/{$invoice->id}/pay")->assertOk();

        $this->assertSame(1, Transaction::count());
        $income = Transaction::firstOrFail();
        $this->assertSame('900.00', $income->amount);
        $this->assertSame($invoice->order_id, $income->order_id);
        $this->assertSame("Campus store purchase - Invoice #{$invoice->id}", $income->description);
    }

    public function test_insufficient_stock_fails_with_the_m1_message_and_changes_nothing(): void
    {
        $student = $this->student();
        $plenty = $this->product(['stock' => 10]);
        $scarce = $this->product(['name' => 'Rare Book', 'stock' => 1]);

        $this->checkout($student, [
            ['productId' => $plenty->id, 'quantity' => 2],
            ['productId' => $scarce->id, 'quantity' => 2],
        ])->assertStatus(422)->assertJsonPath('message', 'Not enough stock available for Rare Book.');

        $this->assertSame(0, Order::count());
        $this->assertSame(0, Transaction::count());
        $this->assertSame(10, $plenty->fresh()->stock, 'stock must not change when checkout fails');
    }

    public function test_duplicate_lines_are_merged_before_the_stock_check(): void
    {
        $student = $this->student();
        $product = $this->product(['stock' => 3]);

        $this->checkout($student, [
            ['productId' => $product->id, 'quantity' => 2],
            ['productId' => $product->id, 'quantity' => 2],
        ])->assertStatus(422);

        $this->checkout($student, [
            ['productId' => $product->id, 'quantity' => 1],
            ['productId' => $product->id, 'quantity' => 2],
        ])->assertCreated()->assertJsonCount(1, 'data.items');

        $this->assertSame(0, $product->fresh()->stock);
    }

    public function test_validation_and_roles(): void
    {
        $student = $this->student();

        $this->checkout($student, [])->assertStatus(422)->assertJsonPath('message', 'Your cart is empty.');
        $this->checkout($student, [['productId' => 999999, 'quantity' => 1]])->assertStatus(422);
        $this->checkout($student, [['productId' => $this->product()->id, 'quantity' => 0]])->assertStatus(422);
        $this->checkout($student, [['productId' => $this->product()->id, 'quantity' => 1]], 'cash')->assertStatus(422);

        $item = [['productId' => $this->product()->id, 'quantity' => 1]];
        $this->checkout($this->accountant(), $item)->assertStatus(403);
        $this->checkout($this->admin(), $item)->assertCreated();
    }

    public function test_checkout_requires_authentication(): void
    {
        $this->postJson('/api/checkout', [])->assertStatus(401);
    }

    public function test_a_user_with_an_unpaid_store_invoice_cannot_delete_their_profile_until_it_is_paid(): void
    {
        $student = $this->student();
        $product = $this->product();
        $this->checkout($student, [['productId' => $product->id, 'quantity' => 1]], 'add-to-invoice')->assertCreated();

        $this->actingAs($student)->deleteJson('/api/profile')->assertStatus(409);

        $invoice = Invoice::firstOrFail();
        $this->actingAs($student)->postJson("/api/invoices/{$invoice->id}/pay")->assertOk();
        $this->actingAs($student)->deleteJson('/api/profile')->assertOk();

        // history is preserved for staff
        $this->assertSame(1, Order::count());
        $this->assertSame(1, Invoice::count());
        $this->assertSame(1, Transaction::count());
    }

    public function test_checkout_for_a_deleted_user_is_refused_by_the_service(): void
    {
        $student = $this->student();
        $product = $this->product();

        $this->actingAs($student)->deleteJson('/api/profile')->assertOk();

        $this->expectException(ApiException::class);
        $this->expectExceptionMessage('Unauthenticated.');

        app(CheckoutService::class)->checkout($student, [['product_id' => $product->id, 'quantity' => 1]], 'pay_now');
    }

    public function test_orders_are_visible_to_their_owner_and_staff_only(): void
    {
        $alice = $this->student();
        $bob = $this->student();
        $product = $this->product();
        $orderId = $this->checkout($alice, [['productId' => $product->id, 'quantity' => 1]])->json('data.id');

        $this->actingAs($alice)->getJson("/api/orders/{$orderId}")->assertOk()->assertJsonPath('data.items.0.quantity', 1);
        $this->actingAs($bob)->getJson("/api/orders/{$orderId}")->assertStatus(403);
        $this->actingAs($bob)->getJson('/api/orders')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($this->accountant())->getJson('/api/orders')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_every_order_has_exactly_one_financial_record_and_matching_totals(): void
    {
        $student = $this->student();
        $a = $this->product(['price' => '33.33']);
        $b = $this->product(['price' => '12.10']);

        $this->checkout($student, [['productId' => $a->id, 'quantity' => 3], ['productId' => $b->id, 'quantity' => 7]], 'pay-now')->assertCreated();
        $this->checkout($student, [['productId' => $a->id, 'quantity' => 1]], 'add-to-invoice')->assertCreated();

        foreach (Order::with('items')->get() as $order) {
            $itemsTotal = $order->items->sum(fn ($i) => (int) round($i->unit_price * 100) * $i->quantity);
            $this->assertSame((int) round($order->total * 100), $itemsTotal, 'order total = sum of items');

            $records = Invoice::where('order_id', $order->id)->count() + Transaction::where('order_id', $order->id)->count();
            $this->assertSame(1, $records, 'exactly one invoice OR income per order at checkout time');
        }

        $this->assertSame(Product::count(), 2);
    }
}
