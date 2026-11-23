<?php

namespace App\Http\Requests;

use App\Exceptions\ApiException;
use App\Models\Transaction;
use Illuminate\Validation\Rule;

/**
 * Budget transaction (Milestone 1: amount > 0, date and description required).
 *
 * authorize() runs BEFORE validation, so a protected (order-linked) transaction
 * answers 409 instead of a misleading 422 on update.
 */
class TransactionRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        $transaction = $this->route('transaction');

        if (! $this->isMethod('POST') && $transaction instanceof Transaction && $transaction->isOrderLinked()) {
            throw new ApiException(Transaction::PROTECTED_MESSAGE, 409, 'transaction_protected');
        }

        return true;
    }

    public function rules(): array
    {
        $presence = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'department' => [$presence, 'required', Rule::in(Transaction::DEPARTMENTS)],
            'type' => [$presence, 'required', Rule::in(['income', 'expense'])],
            'amount' => [$presence, 'required', 'numeric', 'gt:0', 'max:9999999999.99'],
            'date' => [$presence, 'required', 'date_format:Y-m-d'],
            'description' => [$presence, 'required', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        $m1 = 'Please enter a positive amount, a date and a description.';

        return [
            'department.required' => 'Please choose a department.',
            'department.in' => 'Please choose a valid department.',
            'type.required' => 'Please choose income or expense.',
            'type.in' => 'Transaction type must be income or expense.',
            'amount.required' => $m1,
            'amount.numeric' => $m1,
            'amount.gt' => $m1,
            'amount.max' => $m1,
            'date.required' => $m1,
            'date.date_format' => $m1,
            'description.required' => $m1,
            'description.max' => 'The description is too long.',
        ];
    }
}
