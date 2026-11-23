<?php

namespace Database\Seeders;

use App\Models\Invoice;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * OPTIONAL Milestone 2 demonstration data. It is NOT called by DatabaseSeeder:
 *
 *     php artisan db:seed --class=DemoDataSeeder
 *
 * Run the normal seeders first (php artisan db:seed) so the demo student exists.
 *
 * What it creates
 *   - 3 manual invoices for the demo student: two unpaid, one paid.
 *   - 8 manual budget transactions: one income and one expense in each of the
 *     four departments.
 *
 * What it never does
 *   - It creates no orders, order items, users, products or employees, and no
 *     order-linked invoices or transactions: those come only from real checkout
 *     and invoice-payment workflows.
 *   - It never updates or deletes anything. A record is created only when no
 *     manual record with the same natural key exists, so it is safe to run
 *     repeatedly and after the demo has edited or paid some of these rows.
 *     Natural keys deliberately ignore amounts, dates and status for that reason.
 *       invoice:     (student, description) with no order
 *       transaction: (department, type, description) with no order
 */
class DemoDataSeeder extends Seeder
{
    /** Username of the demo student created by UserSeeder. */
    public const STUDENT_USERNAME = 'student';

    /** [description, amount, status, issue date, due date, paid at] */
    private const INVOICES = [
        ['Tuition - Fall 2026 instalment 1', '12000.00', Invoice::UNPAID, '2026-11-01', '2026-12-31', null],
        ['Library fine', '150.00', Invoice::PAID, '2026-11-01', '2026-11-15', '2026-11-10 10:00:00'],
        ['Lab fees', '800.00', Invoice::UNPAID, '2026-11-01', '2026-12-20', null],
    ];

    /** [department, type, amount, date, description] */
    private const TRANSACTIONS = [
        ['Bookstore', 'income', '15000.00', '2026-11-02', 'Semester book sales'],
        ['Bookstore', 'expense', '6000.00', '2026-11-05', 'Restock order'],
        ['IT', 'income', '3000.00', '2026-11-03', 'Lab usage fees'],
        ['IT', 'expense', '8500.00', '2026-11-06', 'Network equipment'],
        ['Library', 'income', '2500.00', '2026-11-04', 'Membership fees'],
        ['Library', 'expense', '4000.00', '2026-11-07', 'Journal subscriptions'],
        ['Administration', 'income', '10000.00', '2026-11-08', 'Student activity fees'],
        ['Administration', 'expense', '1800.00', '2026-11-09', 'Office supplies'],
    ];

    public function run(): void
    {
        DB::transaction(function () {
            $this->seedInvoices();
            $this->seedTransactions();
        });
    }

    private function seedInvoices(): void
    {
        $student = User::where('username', self::STUDENT_USERNAME)->where('role', 'student')->first();

        if (! $student) {
            $this->command?->warn("Demo student '".self::STUDENT_USERNAME."' not found - invoices skipped. Run 'php artisan db:seed' first.");

            return;
        }

        foreach (self::INVOICES as [$description, $amount, $status, $issueDate, $dueDate, $paidAt]) {
            $exists = Invoice::where('student_id', $student->id)
                ->whereNull('order_id')
                ->where('description', $description)
                ->exists();

            if ($exists) {
                continue;
            }

            $invoice = new Invoice([
                'student_id' => $student->id,
                'description' => $description,
                'amount' => $amount,
                'issue_date' => $issueDate,
                'due_date' => $dueDate,
            ]);

            // status and paid_at are not mass-assignable (money records stay consistent);
            // the paid invoice must carry paid_at (database CHECK constraint).
            $invoice->status = $status;
            $invoice->paid_at = $paidAt ? Carbon::parse($paidAt) : null;
            $invoice->save();
        }
    }

    private function seedTransactions(): void
    {
        foreach (self::TRANSACTIONS as [$department, $type, $amount, $date, $description]) {
            $exists = Transaction::whereNull('order_id')
                ->where('department', $department)
                ->where('type', $type)
                ->where('description', $description)
                ->exists();

            if ($exists) {
                continue;
            }

            Transaction::create([
                'department' => $department,
                'type' => $type,
                'amount' => $amount,
                'date' => $date,
                'description' => $description,
            ]);
        }
    }
}
