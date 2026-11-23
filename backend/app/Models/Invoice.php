<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * order_id, status and paid_at are NOT mass-assignable: they are only set by
 * CheckoutService and InvoicePaymentService so money records stay consistent.
 */
#[Fillable(['student_id', 'description', 'amount', 'issue_date', 'due_date'])]
class Invoice extends Model
{
    public const PAID = 'paid';

    public const UNPAID = 'unpaid';

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'issue_date' => 'date:Y-m-d',
            'due_date' => 'date:Y-m-d',
            'paid_at' => 'datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function isPaid(): bool
    {
        return $this->status === self::PAID;
    }

    /** A manual invoice has no order and is the only kind that may be edited or deleted. */
    public function isManual(): bool
    {
        return $this->order_id === null;
    }
}
