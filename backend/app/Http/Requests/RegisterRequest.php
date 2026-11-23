<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

/** Milestone 1 signup form: username, fullName, email, pictureUrl, password, creditCard, preferences. */
class RegisterRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'username' => ['required', 'string', 'max:50', Rule::unique('users', 'username')],
            'fullName' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'pictureUrl' => ['nullable', 'url', 'max:2048'],
            // Milestone 1: the password must not be blank (whitespace only is invalid).
            'password' => ['required', 'string', 'max:255', 'regex:/\S/'],
            'creditCard' => ['nullable', 'string', 'max:30'],
            'preferences' => ['nullable', 'array', 'max:20'],
            'preferences.*' => ['string', 'max:50'],
        ];
    }

    public function messages(): array
    {
        $m1 = 'Username or email already exists, or password is invalid.';

        return [
            'username.required' => 'Username is required.',
            'username.unique' => $m1,
            'fullName.required' => 'Full name is required.',
            'email.required' => 'Email is required.',
            'email.email' => 'Please enter a valid email address.',
            'email.unique' => $m1,
            'pictureUrl.url' => 'Picture URL must be a valid URL.',
            'password.required' => $m1,
            'password.regex' => $m1,
        ];
    }
}
