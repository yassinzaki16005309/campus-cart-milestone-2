import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Budget } from './budget';
import { Transaction } from '../../core/models/transaction.model';

const API = 'http://localhost:8000/api/transactions';

describe('Budget', () => {
  let http: HttpTestingController;
  let nextId = 1;

  // Creates the component and answers its first request (the list of transactions)
  // with the given rows, like the Laravel API (and the Campus Store income) would.
  async function createBudget(saved: Transaction[] = []): Promise<Budget> {
    await TestBed.configureTestingModule({
      imports: [Budget],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Budget);
    http.expectOne(API).flush({ data: saved });
    return fixture.componentInstance;
  }

  // Fills the form fields, clicks "Add" and plays the server's answer
  function addTransaction(budget: Budget, type: 'income' | 'expense', amount: number): void {
    budget.newType.set(type);
    budget.newAmount.set(amount);
    budget.newDate.set('2026-11-10');
    budget.newDescription.set('Test transaction');
    const department = budget.selectedDepartment();

    budget.addTransaction();

    const request = http.expectOne(API);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      department,
      type,
      amount,
      date: '2026-11-10',
      description: 'Test transaction',
    });
    request.flush({
      data: {
        id: nextId++,
        department,
        type,
        amount,
        date: '2026-11-10',
        description: 'Test transaction',
      },
    });
  }

  afterEach(() => http.verify());

  it('should create with zero totals when the server has no transactions', async () => {
    const budget = await createBudget();
    expect(budget).toBeTruthy();
    expect(budget.totalIncome()).toBe(0);
    expect(budget.totalExpenses()).toBe(0);
    expect(budget.balance()).toBe(0);
  });

  it('should add an income transaction through the API', async () => {
    const budget = await createBudget();
    addTransaction(budget, 'income', 450);

    expect(budget.transactions().length).toBe(1);
    expect(budget.transactions()[0].type).toBe('income');
    expect(budget.totalIncome()).toBe(450);
  });

  it('should add an expense transaction', async () => {
    const budget = await createBudget();
    addTransaction(budget, 'expense', 100);

    expect(budget.transactions()[0].type).toBe('expense');
    expect(budget.totalExpenses()).toBe(100);
  });

  it('should not send an invalid transaction', async () => {
    const budget = await createBudget();
    budget.newAmount.set(0);
    budget.newDate.set('2026-11-10');
    budget.newDescription.set('x');

    budget.addTransaction();

    expect(budget.errorMessage()).toBe('Please enter a positive amount, a date and a description.');
    expect(budget.transactions().length).toBe(0);
  });

  it('should calculate balance as income minus expenses', async () => {
    const budget = await createBudget();
    addTransaction(budget, 'income', 450);
    addTransaction(budget, 'expense', 100);

    expect(budget.totalIncome()).toBe(450);
    expect(budget.totalExpenses()).toBe(100);
    expect(budget.balance()).toBe(350);
  });

  it('should only count transactions of the selected department', async () => {
    const budget = await createBudget([
      {
        id: 1,
        department: 'Bookstore',
        type: 'income',
        amount: 200,
        date: '2026-11-01',
        description: 'a',
      },
      {
        id: 2,
        department: 'IT',
        type: 'income',
        amount: 999,
        date: '2026-11-01',
        description: 'b',
      },
    ]);

    budget.selectedDepartment.set('Bookstore');
    expect(budget.totalIncome()).toBe(200);

    budget.selectedDepartment.set('IT');
    expect(budget.totalIncome()).toBe(999);
  });

  it('should include Bookstore income created by the Campus Store on the server', async () => {
    const storeSale = {
      id: 1,
      department: 'Bookstore',
      type: 'income',
      amount: 75,
      date: '2026-11-11',
      description: 'Campus store purchase',
      orderId: 12,
    } as Transaction;
    const budget = await createBudget([storeSale]);

    budget.selectedDepartment.set('Bookstore');
    expect(budget.totalIncome()).toBe(75);
    expect(budget.balance()).toBe(75);
  });

  it('should update the chart data when transactions change', async () => {
    const budget = await createBudget();
    expect(budget.barChartData().datasets[0].data).toEqual([0, 0]);

    addTransaction(budget, 'income', 450);
    expect(budget.barChartData().datasets[0].data).toEqual([450, 0]);
    expect(budget.doughnutChartData().datasets[0].data).toEqual([450, 0]);

    addTransaction(budget, 'expense', 100);
    expect(budget.barChartData().datasets[0].data).toEqual([450, 100]);
    expect(budget.doughnutChartData().datasets[0].data).toEqual([450, 100]);
  });

  it('should delete a transaction through the API', async () => {
    const budget = await createBudget();
    addTransaction(budget, 'income', 450);
    const id = budget.transactions()[0].id;

    budget.deleteTransaction(id);

    const request = http.expectOne(`${API}/${id}`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ message: 'Transaction deleted successfully.' });

    expect(budget.transactions().length).toBe(0);
    expect(budget.totalIncome()).toBe(0);
  });

  it('should keep a store-income transaction and show the 409 message when the server protects it', async () => {
    const budget = await createBudget([
      {
        id: 7,
        department: 'Bookstore',
        type: 'income',
        amount: 75,
        date: '2026-11-11',
        description: 'Campus store purchase',
      },
    ]);

    budget.deleteTransaction(7);

    http
      .expectOne(`${API}/7`)
      .flush(
        {
          message:
            'This transaction was created by a store purchase and cannot be modified or deleted.',
          code: 'transaction_protected',
        },
        { status: 409, statusText: 'Conflict' },
      );

    expect(budget.transactions().length).toBe(1);
    expect(budget.errorMessage()).toBe(
      'This transaction was created by a store purchase and cannot be modified or deleted.',
    );
  });

  it('should show a message when the transactions cannot be loaded', async () => {
    await TestBed.configureTestingModule({
      imports: [Budget],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Budget);

    http.expectOne(API).error(new ProgressEvent('error'), { status: 0 });

    expect(fixture.componentInstance.errorMessage()).toBe(
      'Cannot reach the server. Please check your connection and try again.',
    );
  });
});
