<?php

namespace App\Http\Requests;

class ProductRequest extends ApiFormRequest
{
    public function rules(): array
    {
        $presence = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'name' => [$presence, 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'category' => [$presence, 'required', 'string', 'max:255'],
            'price' => [$presence, 'required', 'numeric', 'min:0', 'max:99999999.99'],
            'stock' => [$presence, 'required', 'integer', 'min:0', 'max:1000000'],
            'imageUrl' => ['sometimes', 'nullable', 'string', 'max:2048'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Product name is required.',
            'category.required' => 'Product category is required.',
            'price.required' => 'Price must be a number that is 0 or more.',
            'price.numeric' => 'Price must be a number that is 0 or more.',
            'price.min' => 'Price must be a number that is 0 or more.',
            'stock.required' => 'Stock must be a whole number that is 0 or more.',
            'stock.integer' => 'Stock must be a whole number that is 0 or more.',
            'stock.min' => 'Stock must be a whole number that is 0 or more.',
        ];
    }
}
