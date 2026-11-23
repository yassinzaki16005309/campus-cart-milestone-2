<?php

namespace Database\Seeders;

use App\Models\Employee;
use Illuminate\Database\Seeder;

/** The four Milestone 1 default employees. Existing rows are never modified. */
class EmployeeSeeder extends Seeder
{
    public function run(): void
    {
        $employees = [
            ['Ahmed Hassan', 'Computer Science', 18000, 2000, 1500],
            ['Sara Mahmoud', 'Engineering', 20000, 2500, 2000],
            ['Omar Khaled', 'Bookstore', 9000, 500, 400],
            ['Nour Adel', 'Administration', 12000, 1000, 900],
        ];

        foreach ($employees as [$name, $department, $base, $allowances, $deductions]) {
            Employee::firstOrCreate(
                ['full_name' => $name, 'department' => $department],
                ['base_salary' => $base, 'allowances' => $allowances, 'deductions' => $deductions]
            );
        }
    }
}
