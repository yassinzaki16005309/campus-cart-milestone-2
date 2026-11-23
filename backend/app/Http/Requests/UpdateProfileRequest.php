<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class UpdateProfileRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'fullName' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => [
                'sometimes', 'required', 'email', 'max:255',
                Rule::unique('users', 'email')->ignore($this->user()->id),
            ],
            'pictureUrl' => ['sometimes', 'nullable', 'url', 'max:2048'],
            'preferences' => ['sometimes', 'nullable', 'array', 'max:20'],
            'preferences.*' => ['string', 'max:50'],
            'creditCard' => ['sometimes', 'nullable', 'string', 'max:30'],
        ];
    }

    public function messages(): array
    {
        return [
            'fullName.required' => 'Full name is required.',
            'email.required' => 'Email is required.',
            'email.email' => 'Please enter a valid email address.',
            'email.unique' => 'This email is already used by another account.',
            'pictureUrl.url' => 'Picture URL must be a valid URL.',
        ];
    }
}
