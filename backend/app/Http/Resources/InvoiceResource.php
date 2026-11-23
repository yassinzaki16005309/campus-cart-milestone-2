<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Same field names as the Angular Invoice model, plus orderId/paidAt. */
class InvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'studentId' => $this->student_id,
            'description' => $this->description,
            'amount' => (float) $this->amount,
            'status' => $this->status,
            'issueDate' => $this->issue_date?->format('Y-m-d'),
            'dueDate' => $this->due_date?->format('Y-m-d'),
            'paidAt' => $this->paid_at?->toIso8601String(),
            'orderId' => $this->order_id,
        ];
    }
}
