<?php

namespace App\Http\Requests;

use App\Models\Employee;
use App\Support\Money;
use Illuminate\Validation\Validator;

/**
 * Milestone 1 payroll rules:
 *  - name and department are required;
 *  - salary, allowances and deductions are numbers >= 0;
 *  - deductions cannot exceed base salary + allowances (also on partial updates).
 */
class EmployeeRequest extends ApiFormRequest
{
    private const MAX = 9999999999.99;

    public function rules(): array
    {
        $presence = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'fullName' => [$presence, 'required', 'string', 'max:255'],
            'department' => [$presence, 'required', 'string', 'max:255'],
            'baseSalary' => [$presence, 'required', 'numeric', 'min:0', 'max:'.self::MAX],
            'allowances' => [$presence, 'required', 'numeric', 'min:0', 'max:'.self::MAX],
            'deductions' => [$presence, 'required', 'numeric', 'min:0', 'max:'.self::MAX],
        ];
    }

    public function messages(): array
    {
        $numbers = 'Salary, allowances and deductions must be numbers that are 0 or more.';

        return [
            'fullName.required' => 'Name and department are required.',
            'department.required' => 'Name and department are required.',
            'baseSalary.required' => $numbers,
            'baseSalary.numeric' => $numbers,
            'baseSalary.min' => $numbers,
            'baseSalary.max' => $numbers,
            'allowances.required' => $numbers,
            'allowances.numeric' => $numbers,
            'allowances.min' => $numbers,
            'allowances.max' => $numbers,
            'deductions.required' => $numbers,
            'deductions.numeric' => $numbers,
            'deductions.min' => $numbers,
            'deductions.max' => $numbers,
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                /** @var Employee|null $current */
                $current = $this->route('employee');

                // Merge with the stored values so a partial update cannot bypass the rule.
                $base = $this->input('baseSalary', $current?->base_salary);
                $allowances = $this->input('allowances', $current?->allowances);
                $deductions = $this->input('deductions', $current?->deductions);

                if (Money::toCents($deductions) > Money::toCents($base) + Money::toCents($allowances)) {
                    $validator->errors()->add('deductions', 'Deductions cannot be more than base salary plus allowances.');
                }
            },
        ];
    }
}
