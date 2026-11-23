<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * order_id is NOT mass-assignable: store income is created only by the
 * checkout / invoice payment services, and order-linked rows are read-only.
 */
#[Fillable(['department', 'type', 'amount', 'date', 'description'])]
class Transaction extends Model
{
    public const DEPARTMENTS = ['Bookstore', 'IT', 'Library', 'Administration'];

    public const PROTECTED_MESSAGE = 'This transaction was created by a store purchase and cannot be modified or deleted.';

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'date' => 'date:Y-m-d',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** Transactions created from store purchases are protected (409 on update/delete). */
    public function isOrderLinked(): bool
    {
        return $this->order_id !== null;
    }
}
