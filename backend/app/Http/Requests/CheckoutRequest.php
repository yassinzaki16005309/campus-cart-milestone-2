<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

/**
 * The client sends only product ids, quantities and the payment option.
 * Prices and totals are never accepted from the client.
 * paymentOption uses the same strings as the Angular store: 'pay-now' | 'add-to-invoice'.
 */
class CheckoutRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.productId' => ['required', 'integer', 'min:1'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:1000'],
            'paymentOption' => ['required', Rule::in(['pay-now', 'add-to-invoice'])],
        ];
    }

    public function messages(): array
    {
        return [
            'items.required' => 'Your cart is empty.',
            'items.min' => 'Your cart is empty.',
            'items.array' => 'Your cart is empty.',
            'items.*.productId.required' => 'Invalid cart item.',
            'items.*.productId.integer' => 'Invalid cart item.',
            'items.*.quantity.required' => 'Invalid cart item.',
            'items.*.quantity.integer' => 'Invalid cart item.',
            'items.*.quantity.min' => 'Invalid cart item.',
            'items.*.quantity.max' => 'Invalid cart item.',
            'paymentOption.required' => 'Please choose a checkout option.',
            'paymentOption.in' => 'Please choose a valid checkout option.',
        ];
    }
}
