<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Same field names as the Angular Employee model. */
class EmployeeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'fullName' => $this->full_name,
            'department' => $this->department,
            'baseSalary' => (float) $this->base_salary,
            'allowances' => (float) $this->allowances,
            'deductions' => (float) $this->deductions,
        ];
    }
}
