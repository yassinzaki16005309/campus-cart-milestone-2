<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Same field names as the Angular User model (core/models/user.model.ts). */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'username' => $this->username,
            'fullName' => $this->name,
            'email' => $this->email,
            'pictureUrl' => $this->picture_url ?? '',
            'role' => $this->role,
            'preferences' => $this->preferences ?? [],
            'creditCardLast4' => $this->credit_card_last4,
        ];
    }
}
