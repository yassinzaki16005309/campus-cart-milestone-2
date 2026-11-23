import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Payroll } from './payroll';
import { Employee } from '../../core/models/employee.model';

const API = 'http://localhost:8000/api/employees';

// The four employees the server seeds (same data as Milestone 1)
const EMPLOYEES: Employee[] = [
  {
    id: 1,
    fullName: 'Ahmed Hassan',
    department: 'Computer Science',
    baseSalary: 18000,
    allowances: 2000,
    deductions: 1500,
  },
  {
    id: 2,
    fullName: 'Sara Mahmoud',
    department: 'Engineering',
    baseSalary: 20000,
    allowances: 2500,
    deductions: 2000,
  },
  {
    id: 3,
    fullName: 'Omar Khaled',
    department: 'Bookstore',
    baseSalary: 9000,
    allowances: 500,
    deductions: 400,
  },
  {
    id: 4,
    fullName: 'Nour Adel',
    department: 'Administration',
    baseSalary: 12000,
    allowances: 1000,
    deductions: 900,
  },
];

describe('Payroll', () => {
  let component: Payroll;
  let fixture: ComponentFixture<Payroll>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Payroll],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Payroll);
    component = fixture.componentInstance;

    // The page loads the employees from the API when it opens
    http.expectOne(API).flush({ data: EMPLOYEES });
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load the employees from the API', () => {
    expect(component.employees().length).toBe(4);
  });

  it('should calculate net salary as base + allowances - deductions', () => {
    const emp = {
      id: 99,
      fullName: 'Test',
      department: 'IT',
      baseSalary: 10000,
      allowances: 1500,
      deductions: 500,
    };
    expect(component.getNetSalary(emp)).toBe(11000);
  });

  it('should add a new employee through the API', () => {
    component.formName = 'Laila Samir';
    component.formDepartment = 'Library';
    component.formBaseSalary = 8000;
    component.formAllowances = 300;
    component.formDeductions = 100;

    component.saveEmployee();

    const request = http.expectOne(API);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      fullName: 'Laila Samir',
      department: 'Library',
      baseSalary: 8000,
      allowances: 300,
      deductions: 100,
    });
    request.flush({
      data: {
        id: 5,
        fullName: 'Laila Samir',
        department: 'Library',
        baseSalary: 8000,
        allowances: 300,
        deductions: 100,
      },
    });

    expect(component.employees().length).toBe(5);
    const added = component.employees()[4];
    expect(added.fullName).toBe('Laila Samir');
    expect(component.getNetSalary(added)).toBe(8200);
    expect(component.formName).toBe('');
  });

  it('should not send an employee with an empty name', () => {
    component.formName = '   ';
    component.formDepartment = 'Library';
    component.formBaseSalary = 8000;

    component.saveEmployee();

    expect(component.employees().length).toBe(4);
    expect(component.errorMessage()).toBe('Name and department are required.');
    // http.verify() in afterEach proves that no request was sent
  });

  it('should reject negative numbers before calling the server', () => {
    component.formName = 'X';
    component.formDepartment = 'Y';
    component.formBaseSalary = -5;

    component.saveEmployee();

    expect(component.errorMessage()).toBe(
      'Salary, allowances and deductions must be numbers that are 0 or more.',
    );
  });

  it('should reject deductions larger than base salary plus allowances', () => {
    component.formName = 'X';
    component.formDepartment = 'Y';
    component.formBaseSalary = 1000;
    component.formAllowances = 100;
    component.formDeductions = 1101;

    component.saveEmployee();

    expect(component.errorMessage()).toBe(
      'Deductions cannot be more than base salary plus allowances.',
    );
    expect(component.employees().length).toBe(4);
  });

  it('should edit payroll information of an existing employee through the API', () => {
    const first = component.employees()[0];
    component.startEdit(first);
    component.formBaseSalary = 25000;
    component.formDeductions = 1000;

    component.saveEmployee();

    const request = http.expectOne(`${API}/${first.id}`);
    expect(request.request.method).toBe('PUT');
    request.flush({ data: { ...first, baseSalary: 25000, deductions: 1000 } });

    const updated = component.employees()[0];
    expect(updated.id).toBe(first.id);
    expect(updated.baseSalary).toBe(25000);
    expect(component.getNetSalary(updated)).toBe(25000 + first.allowances - 1000);
    expect(component.editingId()).toBeNull();
  });

  it('should show the server message when the server rejects the employee', () => {
    component.formName = 'Laila';
    component.formDepartment = 'Library';
    component.formBaseSalary = 8000;

    component.saveEmployee();

    http
      .expectOne(API)
      .flush(
        { message: 'Deductions cannot be more than base salary plus allowances.' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

    expect(component.errorMessage()).toBe(
      'Deductions cannot be more than base salary plus allowances.',
    );
    expect(component.employees().length).toBe(4);
  });

  it('should build a report with the month and correct net salaries', () => {
    component.selectedMonth = '2026-11';
    const report = component.buildReport();

    expect(report.month).toBe('2026-11');
    expect(report.employees.length).toBe(component.employees().length);
    report.employees.forEach((r) => {
      expect(r.netSalary).toBe(r.baseSalary + r.allowances - r.deductions);
    });
    const total = report.employees.reduce((sum, r) => sum + r.netSalary, 0);
    expect(report.totalNetSalary).toBe(total);
  });

  it('should generate valid JSON text for the report', () => {
    component.selectedMonth = '2026-11';
    component.generateReport();

    const parsed = JSON.parse(component.reportJson());
    expect(parsed.month).toBe('2026-11');
    expect(parsed.employees.length).toBe(component.employees().length);
  });

  it('should show one table row per employee', () => {
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(component.employees().length);
  });
});
