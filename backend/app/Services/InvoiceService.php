<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class InvoiceService
{
    /**
     * Create a MANUAL invoice (no order). Milestone 1 assigns it to the user who
     * creates it; staff may optionally target a student.
     *
     * The student row is locked first so a concurrent account deletion either
     * finishes before (we refuse) or sees this new unpaid invoice (it refuses).
     *
     * @param  array{description:string, amount:string|float|int, due_date:string}  $data
     */
    public function createManual(User $actor, array $data, ?int $studentId = null): Invoice
    {
        $ownerId = ($actor->isStaff() && $studentId) ? $studentId : $actor->id;

        return DB::transaction(function () use ($ownerId, $data) {
            $owner = User::whereKey($ownerId)->lockForUpdate()->first();

            if (! $owner) {
                throw new ApiException('The selected student does not exist.', 422, 'student_not_found');
            }

            $invoice = new Invoice([
                'student_id' => $owner->id,
                'description' => $data['description'],
                'amount' => $data['amount'],
                'issue_date' => now()->toDateString(),
                'due_date' => $data['due_date'],
            ]);
            $invoice->status = Invoice::UNPAID;
            $invoice->save();

            return $invoice;
        }, 3);
    }
}
