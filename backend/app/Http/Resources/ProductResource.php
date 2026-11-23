<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Same field names as the Angular Product model. */
class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description ?? '',
            'category' => $this->category,
            'price' => (float) $this->price,
            'stock' => (int) $this->stock,
            'imageUrl' => $this->image_url ?? '',
        ];
    }
}
