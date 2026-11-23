<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['full_name', 'department', 'base_salary', 'allowances', 'deductions'])]
class Employee extends Model
{
    protected function casts(): array
    {
        return [
            'base_salary' => 'decimal:2',
            'allowances' => 'decimal:2',
            'deductions' => 'decimal:2',
        ];
    }

    /** Net Salary = Base Salary + Allowances - Deductions (Milestone 1 formula). */
    public function netSalary(): float
    {
        return round((float) $this->base_salary + (float) $this->allowances - (float) $this->deductions, 2);
    }
}
