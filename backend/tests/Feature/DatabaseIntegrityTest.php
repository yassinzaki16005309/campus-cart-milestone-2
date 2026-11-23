<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Order;
use App\Models\Transaction;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Tests\ApiTestCase;

/**
 * Proves the MariaDB constraints from the approved schema really reject bad data,
 * independently of the application code (composite FKs, UNIQUE, CHECK).
 */
class DatabaseIntegrityTest extends ApiTestCase
{
    private function order(float|string $total = '100.00', $user = null): Order
    {
        $user ??= $this->student();

        return Order::create(['user_id' => $user->id, 'total' => $total, 'payment_option' => 'add_to_invoice']);
    }

    private function insertInvoice(array $overrides): void
    {
        DB::table('invoices')->insert(array_merge([
            'description' => 'x', 'status' => 'unpaid', 'issue_date' => '2026-11-01', 'due_date' => '2026-12-01',
            'created_at' => now(), 'updated_at' => now(),
        ], $overrides));
    }

    private function insertTransaction(array $overrides): void
    {
        DB::table('transactions')->insert(array_merge([
            'department' => 'Bookstore', 'type' => 'income', 'date' => '2026-11-01', 'description' => 'x',
            'created_at' => now(), 'updated_at' => now(),
        ], $overrides));
    }

    public function test_an_invoice_must_match_its_orders_owner_and_total(): void
    {
        $order = $this->order('100.00');
        $stranger = $this->student();

        $this->expectException(QueryException::class);
        $this->insertInvoice(['order_id' => $order->id, 'student_id' => $stranger->id, 'amount' => '100.00']);
    }

    public function test_an_invoice_amount_must_match_its_order_total(): void
    {
        $order = $this->order('100.00');

        $this->expectException(QueryException::class);
        $this->insertInvoice(['order_id' => $order->id, 'student_id' => $order->user_id, 'amount' => '99.99']);
    }

    public function test_a_matching_invoice_and_manual_invoices_are_accepted(): void
    {
        $order = $this->order('100.00');
        $this->insertInvoice(['order_id' => $order->id, 'student_id' => $order->user_id, 'amount' => '100.00']);
        // manual invoice: NULL order_id skips the composite FK
        $this->insertInvoice(['order_id' => null, 'student_id' => $order->user_id, 'amount' => '55.00']);

        $this->assertSame(2, Invoice::count());
    }

    public function test_one_invoice_per_order(): void
    {
        $order = $this->order('100.00');
        $this->insertInvoice(['order_id' => $order->id, 'student_id' => $order->user_id, 'amount' => '100.00']);

        $this->expectException(UniqueConstraintViolationException::class);
        $this->insertInvoice(['order_id' => $order->id, 'student_id' => $order->user_id, 'amount' => '100.00']);
    }

    public function test_income_must_match_the_order_total(): void
    {
        $order = $this->order('100.00');

        $this->expectException(QueryException::class);
        $this->insertTransaction(['order_id' => $order->id, 'amount' => '100.01']);
    }

    public function test_a_second_income_record_for_the_same_order_is_rejected(): void
    {
        $order = $this->order('100.00');
        $this->insertTransaction(['order_id' => $order->id, 'amount' => '100.00']);

        $this->expectException(UniqueConstraintViolationException::class);
        $this->insertTransaction(['order_id' => $order->id, 'amount' => '100.00']);
    }

    public function test_manual_transactions_are_unrestricted_by_the_order_constraints(): void
    {
        $this->insertTransaction(['order_id' => null, 'amount' => '10.00']);
        $this->insertTransaction(['order_id' => null, 'amount' => '10.00']);

        $this->assertSame(2, Transaction::count());
    }

    public function test_an_order_with_financial_records_cannot_be_deleted(): void
    {
        $order = $this->order('100.00');
        $this->insertTransaction(['order_id' => $order->id, 'amount' => '100.00']);

        $this->expectException(QueryException::class);
        $order->delete();
    }

    public function test_users_with_history_cannot_be_hard_deleted(): void
    {
        $order = $this->order('100.00');

        $this->expectException(QueryException::class);
        DB::table('users')->where('id', $order->user_id)->delete();
    }

    public function test_check_constraints_reject_invalid_values(): void
    {
        foreach ([
            fn () => DB::table('employees')->insert(['full_name' => 'x', 'department' => 'y', 'base_salary' => 100, 'allowances' => 0, 'deductions' => 101]),
            fn () => DB::table('employees')->insert(['full_name' => 'x', 'department' => 'y', 'base_salary' => -1, 'allowances' => 0, 'deductions' => 0]),
            fn () => $this->insertTransaction(['order_id' => null, 'amount' => '0.00']),
            fn () => DB::table('products')->insert(['name' => 'x', 'category' => 'y', 'price' => -1, 'stock' => 1]),
            fn () => DB::table('products')->insert(['name' => 'x', 'category' => 'y', 'price' => 1, 'stock' => -1]),
            // paid status requires paid_at
            fn () => $this->insertInvoice(['order_id' => null, 'student_id' => $this->student()->id, 'amount' => '5.00', 'status' => 'paid']),
        ] as $i => $insert) {
            try {
                $insert();
                $this->fail("Invalid row #{$i} was accepted by the database.");
            } catch (QueryException) {
                $this->addToAssertionCount(1);
            }
        }
    }
}
