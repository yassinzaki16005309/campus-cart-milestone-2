import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Employee } from '../../core/models/employee.model';
import { apiErrorMessage } from '../../core/services/api-error';
import { EmployeeApi } from '../../core/services/employee-api';

export interface SalaryReport {
  month: string;
  generatedAt: string;
  employees: (Employee & { netSalary: number })[];
  totalNetSalary: number;
}

@Component({
  selector: 'app-payroll',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './payroll.html',
  styleUrl: './payroll.css',
})
export class Payroll {
  private api = inject(EmployeeApi);

  // Reactive state (signals). The employees come from the Laravel API.
  employees = signal<Employee[]>([]);
  editingId = signal<number | null>(null);
  errorMessage = signal('');
  reportJson = signal('');

  // Form fields (bound with [(ngModel)])
  formName = '';
  formDepartment = '';
  formBaseSalary: number | null = null;
  formAllowances: number | null = 0;
  formDeductions: number | null = 0;

  // Report month, e.g. "2026-11"
  selectedMonth = new Date().toISOString().slice(0, 7);

  constructor() {
    this.api.list().subscribe({
      next: (employees) => this.employees.set(employees),
      error: (error) => this.errorMessage.set(apiErrorMessage(error)),
    });
  }

  // Net Salary = Base Salary + Allowances - Deductions
  getNetSalary(employee: Employee): number {
    return employee.baseSalary + employee.allowances - employee.deductions;
  }

  saveEmployee(): void {
    const name = this.formName.trim();
    const department = this.formDepartment.trim();
    const base = this.formBaseSalary;
    const allowances = this.formAllowances;
    const deductions = this.formDeductions;

    // Same checks as Milestone 1 (instant feedback). The server repeats them.
    if (!name || !department) {
      this.errorMessage.set('Name and department are required.');
      return;
    }
    if (
      base === null ||
      allowances === null ||
      deductions === null ||
      base < 0 ||
      allowances < 0 ||
      deductions < 0
    ) {
      this.errorMessage.set(
        'Salary, allowances and deductions must be numbers that are 0 or more.',
      );
      return;
    }
    if (deductions > base + allowances) {
      this.errorMessage.set('Deductions cannot be more than base salary plus allowances.');
      return;
    }

    const employee = { fullName: name, department, baseSalary: base, allowances, deductions };
    const editingId = this.editingId();

    const request =
      editingId === null
        ? this.api.create(employee) // ADD
        : this.api.update(editingId, employee); // EDIT

    request.subscribe({
      next: (saved) => {
        this.employees.update((list) =>
          editingId === null ? [...list, saved] : list.map((e) => (e.id === saved.id ? saved : e)),
        );
        this.resetForm();
      },
      error: (error) => this.errorMessage.set(apiErrorMessage(error)),
    });
  }

  startEdit(employee: Employee): void {
    this.editingId.set(employee.id);
    this.formName = employee.fullName;
    this.formDepartment = employee.department;
    this.formBaseSalary = employee.baseSalary;
    this.formAllowances = employee.allowances;
    this.formDeductions = employee.deductions;
    this.errorMessage.set('');
  }

  resetForm(): void {
    this.editingId.set(null);
    this.formName = '';
    this.formDepartment = '';
    this.formBaseSalary = null;
    this.formAllowances = 0;
    this.formDeductions = 0;
    this.errorMessage.set('');
  }

  buildReport(): SalaryReport {
    const rows = this.employees().map((e) => ({ ...e, netSalary: this.getNetSalary(e) }));
    return {
      month: this.selectedMonth,
      generatedAt: new Date().toISOString(),
      employees: rows,
      totalNetSalary: rows.reduce((sum, r) => sum + r.netSalary, 0),
    };
  }

  generateReport(): void {
    this.reportJson.set(JSON.stringify(this.buildReport(), null, 2));
  }

  downloadReport(): void {
    this.generateReport();
    const blob = new Blob([this.reportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `salary-report-${this.selectedMonth}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
