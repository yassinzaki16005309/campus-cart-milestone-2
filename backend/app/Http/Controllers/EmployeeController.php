<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\MapsInput;
use App\Http\Requests\EmployeeRequest;
use App\Http\Resources\EmployeeResource;
use App\Models\Employee;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** Staff payroll (admin + accountant). */
class EmployeeController extends Controller
{
    use MapsInput;

    private const MAP = [
        'fullName' => 'full_name',
        'department' => 'department',
        'baseSalary' => 'base_salary',
        'allowances' => 'allowances',
        'deductions' => 'deductions',
    ];

    public function index(): AnonymousResourceCollection
    {
        return EmployeeResource::collection(Employee::orderBy('id')->get());
    }

    public function store(EmployeeRequest $request): JsonResponse
    {
        $employee = Employee::create($this->mapInput($request, self::MAP));

        return (new EmployeeResource($employee))
            ->additional(['message' => 'Employee added successfully.'])
            ->response()
            ->setStatusCode(201);
    }

    public function show(Employee $employee): EmployeeResource
    {
        return new EmployeeResource($employee);
    }

    public function update(EmployeeRequest $request, Employee $employee): JsonResponse
    {
        $employee->update($this->mapInput($request, self::MAP));

        return (new EmployeeResource($employee))
            ->additional(['message' => 'Employee updated successfully.'])
            ->response();
    }

    public function destroy(Employee $employee): JsonResponse
    {
        $employee->delete();

        return response()->json(['message' => 'Employee deleted successfully.']);
    }

    /** Monthly salary report, same JSON structure as the Milestone 1 download. */
    public function report(Request $request): JsonResponse
    {
        $validated = $request->validate(['month' => ['nullable', 'date_format:Y-m']]);

        $rows = Employee::orderBy('id')->get()->map(fn (Employee $e) => [
            'id' => $e->id,
            'fullName' => $e->full_name,
            'department' => $e->department,
            'baseSalary' => (float) $e->base_salary,
            'allowances' => (float) $e->allowances,
            'deductions' => (float) $e->deductions,
            'netSalary' => $e->netSalary(),
        ]);

        $totalCents = $rows->sum(fn ($row) => Money::toCents($row['netSalary']));

        return response()->json([
            'month' => $validated['month'] ?? now()->format('Y-m'),
            'generatedAt' => now()->toIso8601String(),
            'employees' => $rows->values(),
            'totalNetSalary' => (float) Money::fromCents($totalCents),
        ]);
    }
}
