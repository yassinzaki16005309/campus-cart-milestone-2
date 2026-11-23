<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoDataSeeder;
use Illuminate\Support\Carbon;
use Tests\ApiTestCase;

class DemoDataSeederTest extends ApiTestCase
{
    /** The normal M1 seeders (users, employees, products), then the optional demo data. */
    private function seedDemo(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->seed(DemoDataSeeder::class);
    }

    public function test_it_creates_three_invoices_for_the_demo_student_with_correct_amounts_and_statuses(): void
    {
        $this->seedDemo();

        $student = User::where('username', 'student')->firstOrFail();
        $this->assertSame(3, Invoice::count());
        $this->assertSame(3, $student->invoices()->count());

        $expected = [
            'Tuition - Fall 2026 instalment 1' => ['12000.00', Invoice::UNPAID, '2026-12-31'],
            'Library fine' => ['150.00', Invoice::PAID, '2026-11-15'],
            'Lab fees' => ['800.00', Invoice::UNPAID, '2026-12-20'],
        ];

        foreach ($expected as $description => [$amount, $status, $dueDate]) {
            $invoice = Invoice::with('student')->where('description', $description)->firstOrFail();

            $this->assertSame($amount, $invoice->amount, $description);
            $this->assertSame($status, $invoice->status, $description);
            $this->assertSame('2026-11-01', $invoice->issue_date->toDateString(), $description);
            $this->assertSame($dueDate, $invoice->due_date->toDateString(), $description);
            $this->assertSame($student->id, $invoice->student_id, $description);
            $this->assertSame('student', $invoice->student->username, $description);
            $this->assertSame('student', $invoice->student->role, $description);
            $this->assertTrue($invoice->isManual(), $description);
        }

        $this->assertSame(2, Invoice::where('status', Invoice::UNPAID)->count());
        $this->assertSame(1, Invoice::where('status', Invoice::PAID)->count());
    }

    public function test_the_paid_invoice_has_a_paid_timestamp_and_the_unpaid_ones_do_not(): void
    {
        $this->seedDemo();

        $paid = Invoice::where('description', 'Library fine')->firstOrFail();
        $this->assertTrue($paid->isPaid());
        $this->assertNotNull($paid->paid_at);
        $this->assertSame('2026-11-10', $paid->paid_at->toDateString());

        foreach (['Tuition - Fall 2026 instalment 1', 'Lab fees'] as $description) {
            $invoice = Invoice::where('description', $description)->firstOrFail();
            $this->assertFalse($invoice->isPaid(), $description);
            $this->assertNull($invoice->paid_at, $description);
        }
    }

    public function test_it_creates_eight_manual_transactions_one_income_and_one_expense_per_department(): void
    {
        $this->seedDemo();

        $this->assertSame(8, Transaction::count());
        $this->assertEqualsCanonicalizing(
            Transaction::DEPARTMENTS,
            Transaction::query()->distinct()->pluck('department')->all()
        );

        $expected = [
            ['Bookstore', 'income', '15000.00', 'Semester book sales'],
            ['Bookstore', 'expense', '6000.00', 'Restock order'],
            ['IT', 'income', '3000.00', 'Lab usage fees'],
            ['IT', 'expense', '8500.00', 'Network equipment'],
            ['Library', 'income', '2500.00', 'Membership fees'],
            ['Library', 'expense', '4000.00', 'Journal subscriptions'],
            ['Administration', 'income', '10000.00', 'Student activity fees'],
            ['Administration', 'expense', '1800.00', 'Office supplies'],
        ];

        foreach ($expected as [$department, $type, $amount, $description]) {
            $transaction = Transaction::where('description', $description)->firstOrFail();

            $this->assertSame($department, $transaction->department, $description);
            $this->assertSame($type, $transaction->type, $description);
            $this->assertSame($amount, $transaction->amount, $description);
            $this->assertNull($transaction->order_id, $description);
            $this->assertFalse($transaction->isOrderLinked(), $description);
            $this->assertNull($transaction->order, $description);
        }

        foreach (Transaction::DEPARTMENTS as $department) {
            $this->assertSame(1, Transaction::where('department', $department)->where('type', 'income')->count(), $department);
            $this->assertSame(1, Transaction::where('department', $department)->where('type', 'expense')->count(), $department);
        }
    }

    public function test_every_department_ends_with_a_meaningful_balance(): void
    {
        $this->seedDemo();

        $balance = fn (string $department): string => number_format(
            (float) Transaction::where('department', $department)->where('type', 'income')->sum('amount')
            - (float) Transaction::where('department', $department)->where('type', 'expense')->sum('amount'),
            2, '.', ''
        );

        $this->assertSame('9000.00', $balance('Bookstore'));
        $this->assertSame('-5500.00', $balance('IT'));
        $this->assertSame('-1500.00', $balance('Library'));
        $this->assertSame('8200.00', $balance('Administration'));
    }

    public function test_it_creates_no_orders_and_no_order_linked_records_and_touches_nothing_else(): void
    {
        $this->seedDemo();

        $this->assertSame(0, Order::count());
        $this->assertSame(0, OrderItem::count());
        $this->assertSame(0, Invoice::whereNotNull('order_id')->count());
        $this->assertSame(0, Transaction::whereNotNull('order_id')->count());

        // Exactly what the normal seeders created: the demo seeder adds no users, products or employees.
        $this->assertSame(3, User::count());
        $this->assertSame(4, Employee::count());
        $this->assertSame(6, Product::count());
    }

    public function test_database_seeder_does_not_call_it(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(3, User::count());
        $this->assertSame(0, Invoice::count());
        $this->assertSame(0, Transaction::count());
    }

    public function test_running_it_repeatedly_creates_no_duplicates(): void
    {
        $this->seedDemo();
        $this->seed(DemoDataSeeder::class);
        $this->seed(DemoDataSeeder::class);
        $this->seed(DatabaseSeeder::class); // the M1 seeders in between must not matter either

        $this->assertSame(3, Invoice::count());
        $this->assertSame(8, Transaction::count());
        $this->assertSame(3, User::count());
        $this->assertSame(0, Order::count());
    }

    public function test_existing_records_are_never_overwritten(): void
    {
        $this->seedDemo();

        // The demo edits and pays rows: change amounts, dates and status.
        $tuition = Invoice::where('description', 'Tuition - Fall 2026 instalment 1')->firstOrFail();
        $tuition->amount = '1.00';
        $tuition->due_date = '2027-02-01';
        $tuition->status = Invoice::PAID;
        $tuition->paid_at = Carbon::parse('2026-11-20 09:30:00');
        $tuition->save();

        $lab = Invoice::where('description', 'Lab fees')->firstOrFail();
        $lab->update(['amount' => '999.99']);

        $income = Transaction::where('description', 'Semester book sales')->firstOrFail();
        $income->update(['amount' => '1.00', 'date' => '2027-01-15']);

        $this->seed(DemoDataSeeder::class);

        $this->assertSame(3, Invoice::count());
        $this->assertSame(8, Transaction::count());

        $tuition = $tuition->fresh();
        $this->assertSame('1.00', $tuition->amount);
        $this->assertSame('2027-02-01', $tuition->due_date->toDateString());
        $this->assertTrue($tuition->isPaid());
        $this->assertSame('2026-11-20', $tuition->paid_at->toDateString());

        $this->assertSame('999.99', $lab->fresh()->amount);
        $this->assertSame(Invoice::UNPAID, $lab->fresh()->status);

        $this->assertSame('1.00', $income->fresh()->amount);
        $this->assertSame('2027-01-15', $income->fresh()->date->toDateString());
    }

    public function test_a_deleted_demo_row_is_recreated_and_the_others_are_left_alone(): void
    {
        $this->seedDemo();

        Transaction::where('description', 'Office supplies')->delete();
        Transaction::where('description', 'Restock order')->update(['amount' => '7.00']);

        $this->seed(DemoDataSeeder::class);

        $this->assertSame(8, Transaction::count());
        $this->assertSame('1800.00', Transaction::where('description', 'Office supplies')->firstOrFail()->amount);
        $this->assertSame('7.00', Transaction::where('description', 'Restock order')->firstOrFail()->amount);
    }

    public function test_real_checkout_records_are_left_untouched_and_demo_rows_are_separate(): void
    {
        $this->seed(DatabaseSeeder::class);

        $student = User::where('username', 'student')->firstOrFail();
        $book = Product::where('name', 'Introduction to Programming')->firstOrFail();
        $stockBefore = $book->stock;

        // Real workflows: one pay-now checkout (income transaction) and one add-to-invoice checkout (invoice).
        $this->actingAs($student)->postJson('/api/checkout', [
            'items' => [['productId' => $book->id, 'quantity' => 1]], 'paymentOption' => 'pay-now',
        ])->assertCreated();
        $this->actingAs($student)->postJson('/api/checkout', [
            'items' => [['productId' => $book->id, 'quantity' => 2]], 'paymentOption' => 'add-to-invoice',
        ])->assertCreated();

        $orderTransaction = Transaction::whereNotNull('order_id')->firstOrFail();
        $orderInvoice = Invoice::whereNotNull('order_id')->firstOrFail();
        $orderTransactionBefore = $orderTransaction->only(['department', 'type', 'amount', 'order_id']);
        $orderInvoiceBefore = $orderInvoice->only(['student_id', 'amount', 'status', 'order_id', 'description']);

        $this->seed(DemoDataSeeder::class);
        $this->seed(DemoDataSeeder::class);

        $this->assertSame(2, Order::count());
        $this->assertSame(4, Invoice::count());          // 3 demo + 1 order-linked
        $this->assertSame(9, Transaction::count());      // 8 demo + 1 order-linked
        $this->assertSame(3, Invoice::whereNull('order_id')->count());
        $this->assertSame(8, Transaction::whereNull('order_id')->count());
        $this->assertSame($orderTransactionBefore, $orderTransaction->fresh()->only(['department', 'type', 'amount', 'order_id']));
        $this->assertSame($orderInvoiceBefore, $orderInvoice->fresh()->only(['student_id', 'amount', 'status', 'order_id', 'description']));
        $this->assertSame($stockBefore - 3, $book->fresh()->stock); // only the two real checkouts changed stock
    }

    public function test_it_skips_invoices_but_still_seeds_transactions_when_the_demo_student_is_missing(): void
    {
        // No UserSeeder: there is no demo student.
        $this->seed(DemoDataSeeder::class);

        $this->assertSame(0, Invoice::count());
        $this->assertSame(0, User::count());
        $this->assertSame(8, Transaction::count());
    }

    public function test_it_does_not_attach_invoices_to_a_demo_username_that_is_not_a_student(): void
    {
        $this->user('admin', ['username' => 'student', 'email' => 'not-the-student@example.com']);

        $this->seed(DemoDataSeeder::class);

        $this->assertSame(0, Invoice::count());
        $this->assertSame(8, Transaction::count());
    }
}
