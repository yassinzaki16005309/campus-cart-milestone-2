<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Same field names as the Angular Transaction model, plus orderId (non-null = protected). */
class TransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'department' => $this->department,
            'type' => $this->type,
            'amount' => (float) $this->amount,
            'date' => $this->date?->format('Y-m-d'),
            'description' => $this->description,
            'orderId' => $this->order_id,
        ];
    }
}
