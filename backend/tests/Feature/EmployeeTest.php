<?php

namespace Tests\Feature;

use Tests\ApiTestCase;

class EmployeeTest extends ApiTestCase
{
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'fullName' => 'Layla Samir', 'department' => 'Library',
            'baseSalary' => 8000, 'allowances' => 500, 'deductions' => 300,
        ], $overrides);
    }

    public function test_only_admin_and_accountant_can_use_payroll(): void
    {
        $this->getJson('/api/employees')->assertStatus(401);
        $this->actingAs($this->student())->getJson('/api/employees')->assertStatus(403);
        $this->actingAs($this->accountant())->getJson('/api/employees')->assertOk();
        $this->actingAs($this->admin())->getJson('/api/employees')->assertOk();
    }

    public function test_full_crud(): void
    {
        $admin = $this->admin();

        $id = $this->actingAs($admin)->postJson('/api/employees', $this->payload())
            ->assertCreated()->assertJsonPath('data.fullName', 'Layla Samir')->json('data.id');

        $this->actingAs($admin)->getJson("/api/employees/{$id}")->assertOk()->assertJsonPath('data.baseSalary', 8000);

        $this->actingAs($admin)->putJson("/api/employees/{$id}", $this->payload(['baseSalary' => 9000]))
            ->assertOk()->assertJsonPath('data.baseSalary', 9000);

        $this->actingAs($admin)->deleteJson("/api/employees/{$id}")->assertOk();
        $this->actingAs($admin)->getJson("/api/employees/{$id}")->assertStatus(404);
    }

    public function test_deductions_cannot_exceed_base_plus_allowances(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/api/employees', $this->payload(['deductions' => 8501]))
            ->assertStatus(422)
            ->assertJsonPath('message', 'Deductions cannot be more than base salary plus allowances.');

        // exactly equal is allowed (net salary 0)
        $this->actingAs($this->admin())
            ->postJson('/api/employees', $this->payload(['deductions' => 8500]))
            ->assertCreated();
    }

    public function test_a_partial_update_cannot_bypass_the_deductions_rule(): void
    {
        $employee = $this->employee(); // gross 11000

        $this->actingAs($this->admin())
            ->patchJson("/api/employees/{$employee->id}", ['deductions' => 11001])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Deductions cannot be more than base salary plus allowances.');

        $this->actingAs($this->admin())
            ->patchJson("/api/employees/{$employee->id}", ['baseSalary' => 100]) // gross 1100 < deductions 500? no, still valid
            ->assertOk();

        $this->actingAs($this->admin())
            ->patchJson("/api/employees/{$employee->id}", ['baseSalary' => 0, 'allowances' => 0]) // gross 0 < deductions 500
            ->assertStatus(422);
    }

    public function test_m1_validation_messages(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->postJson('/api/employees', $this->payload(['fullName' => '']))
            ->assertStatus(422)->assertJsonPath('message', 'Name and department are required.');

        $this->actingAs($admin)->postJson('/api/employees', $this->payload(['department' => '']))
            ->assertStatus(422)->assertJsonPath('message', 'Name and department are required.');

        $this->actingAs($admin)->postJson('/api/employees', $this->payload(['baseSalary' => -1]))
            ->assertStatus(422)
            ->assertJsonPath('message', 'Salary, allowances and deductions must be numbers that are 0 or more.');

        $this->actingAs($admin)->postJson('/api/employees', $this->payload(['allowances' => 'abc']))
            ->assertStatus(422)
            ->assertJsonPath('message', 'Salary, allowances and deductions must be numbers that are 0 or more.');
    }

    public function test_salary_report_uses_the_m1_net_salary_formula(): void
    {
        $this->employee(['full_name' => 'A', 'base_salary' => 18000, 'allowances' => 2000, 'deductions' => 1500]);
        $this->employee(['full_name' => 'B', 'base_salary' => 9000, 'allowances' => 500, 'deductions' => 400]);

        $this->actingAs($this->accountant())->getJson('/api/payroll/report?month=2026-11')
            ->assertOk()
            ->assertJsonPath('month', '2026-11')
            ->assertJsonPath('employees.0.netSalary', 18500)
            ->assertJsonPath('employees.1.netSalary', 9100)
            ->assertJsonPath('totalNetSalary', 27600);

        $this->actingAs($this->accountant())->getJson('/api/payroll/report?month=bad')->assertStatus(422);
    }
}
