<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'userId' => $this->user_id,
            'total' => (float) $this->total,
            // Same strings the Angular store uses: 'pay-now' | 'add-to-invoice'.
            'paymentOption' => str_replace('_', '-', $this->payment_option),
            'createdAt' => $this->created_at?->toIso8601String(),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'productId' => $item->product_id,
                'name' => $item->product?->name,
                'quantity' => $item->quantity,
                'unitPrice' => (float) $item->unit_price,
            ])->values()),
            'invoiceId' => $this->whenLoaded('invoice', fn () => $this->invoice?->id),
            'transactionId' => $this->whenLoaded('transaction', fn () => $this->transaction?->id),
        ];
    }
}
