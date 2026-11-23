<?php

namespace App\Http\Requests;

/** Milestone 1 invoice form: description, amount > 0, due date. */
class InvoiceRequest extends ApiFormRequest
{
    public function rules(): array
    {
        $presence = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'description' => [$presence, 'required', 'string', 'max:255'],
            'amount' => [$presence, 'required', 'numeric', 'gt:0', 'max:9999999999.99'],
            'dueDate' => [$presence, 'required', 'date_format:Y-m-d'],
            // Only used by staff on creation; ignored for students.
            'studentId' => ['nullable', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        $m1 = 'Please enter a description and a valid amount.';

        return [
            'description.required' => $m1,
            'amount.required' => $m1,
            'amount.numeric' => $m1,
            'amount.gt' => $m1,
            'amount.max' => $m1,
            'dueDate.required' => 'Please select a due date.',
            'dueDate.date_format' => 'Please select a due date.',
        ];
    }
}
