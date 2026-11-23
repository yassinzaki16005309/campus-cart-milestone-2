import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { StudentFees } from './student-fees';
import { Auth } from '../../core/services/auth';
import { Invoice } from '../../core/models/invoice.model';
import { User } from '../../core/models/user.model';

const API = 'http://localhost:8000/api/invoices';

const STUDENT: User = {
  id: 3,
  username: 'student',
  fullName: 'CampusCart Student',
  email: 'student@campuscart.com',
  pictureUrl: '',
  role: 'student',
  preferences: [],
};
const ADMIN: User = { ...STUDENT, id: 1, username: 'admin', role: 'admin' };
const ACCOUNTANT: User = { ...STUDENT, id: 2, username: 'accountant', role: 'accountant' };

describe('StudentFees', () => {
  let component: StudentFees;
  let fixture: ComponentFixture<StudentFees>;
  let auth: Auth;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentFees],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(Auth);
    auth.setCurrentUser(STUDENT);

    fixture = TestBed.createComponent(StudentFees);
    component = fixture.componentInstance;

    // The page loads the invoices from the API when it opens (none yet)
    http.expectOne(API).flush({ data: [] });
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  const createInvoice = (
    id: number,
    studentId: number,
    status: 'paid' | 'unpaid',
    description = 'Tuition fees',
  ): Invoice => ({
    id,
    studentId,
    description,
    amount: 1000,
    status,
    issueDate: '2026-11-01',
    dueDate: '2026-12-01',
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with an empty invoice list when the server has no invoices', () => {
    expect(component.invoices()).toEqual([]);
    expect(component.myInvoices()).toEqual([]);
  });

  it('should show students only their own invoices', () => {
    component.invoices.set([createInvoice(1, 3, 'unpaid'), createInvoice(2, 4, 'unpaid')]);

    expect(component.myInvoices().length).toBe(1);
    expect(component.myInvoices()[0].studentId).toBe(3);
  });

  it('should allow admins to see all invoices', () => {
    auth.setCurrentUser(ADMIN);

    component.invoices.set([createInvoice(1, 3, 'unpaid'), createInvoice(2, 4, 'paid')]);

    expect(component.myInvoices().length).toBe(2);
  });

  it('should allow accountants to see all invoices', () => {
    auth.setCurrentUser(ACCOUNTANT);

    component.invoices.set([createInvoice(1, 3, 'unpaid'), createInvoice(2, 4, 'paid')]);

    expect(component.myInvoices().length).toBe(2);
  });

  it('should separate unpaid and paid invoices', () => {
    component.invoices.set([
      createInvoice(1, 3, 'unpaid'),
      createInvoice(2, 3, 'paid'),
      createInvoice(3, 3, 'unpaid'),
    ]);

    expect(component.unpaidInvoices().length).toBe(2);
    expect(component.paidInvoices().length).toBe(1);
  });

  it('should create a new invoice through the API', () => {
    component.description = 'Semester tuition';
    component.amount = 5000;
    component.dueDate = '2026-12-31';

    component.createInvoice();

    const request = http.expectOne(API);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      description: 'Semester tuition',
      amount: 5000,
      dueDate: '2026-12-31',
    });
    request.flush({
      data: {
        ...createInvoice(1, 3, 'unpaid', 'Semester tuition'),
        amount: 5000,
        dueDate: '2026-12-31',
      },
    });

    expect(component.invoices().length).toBe(1);
    expect(component.invoices()[0]).toEqual(
      jasmine.objectContaining({
        id: 1,
        studentId: 3,
        description: 'Semester tuition',
        amount: 5000,
        status: 'unpaid',
      }),
    );
    expect(component.successMessage()).toBe('Invoice created successfully.');
    expect(component.description).toBe('');
  });

  it('should trim whitespace from the invoice description', () => {
    component.description = '  Semester tuition  ';
    component.amount = 5000;

    component.createInvoice();

    const request = http.expectOne(API);
    expect(request.request.body.description).toBe('Semester tuition');
    request.flush({ data: createInvoice(1, 3, 'unpaid', 'Semester tuition') });
  });

  it('should reject an empty description or invalid amount', () => {
    component.description = '';
    component.amount = 500;
    component.createInvoice();

    expect(component.invoices()).toEqual([]);
    expect(component.errorMessage()).toBe('Please enter a description and a valid amount.');

    component.description = 'Tuition';
    component.amount = 0;
    component.createInvoice();

    expect(component.invoices()).toEqual([]);
    // http.verify() in afterEach proves that nothing was sent to the server
  });

  it('should reject invoice creation without a due date', () => {
    component.description = 'Tuition';
    component.amount = 500;
    component.dueDate = '';

    component.createInvoice();

    expect(component.invoices()).toEqual([]);
    expect(component.errorMessage()).toBe('Please select a due date.');
  });

  it('should reject invoice creation when the user is logged out', () => {
    auth.setCurrentUser(null);

    component.description = 'Tuition';
    component.amount = 500;
    component.createInvoice();

    expect(component.invoices()).toEqual([]);
    expect(component.errorMessage()).toBe('Please log in first.');
  });

  it('should show the server message when the invoice is rejected', () => {
    component.description = 'Tuition';
    component.amount = 500;

    component.createInvoice();

    http
      .expectOne(API)
      .flush(
        { message: 'Please enter a description and a valid amount.' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

    expect(component.invoices()).toEqual([]);
    expect(component.errorMessage()).toBe('Please enter a description and a valid amount.');
  });

  it('should mark an unpaid invoice as paid through the API', () => {
    const invoice = createInvoice(1, 3, 'unpaid');
    component.invoices.set([invoice]);

    component.markAsPaid(invoice);

    const request = http.expectOne(`${API}/1/pay`);
    expect(request.request.method).toBe('POST');
    request.flush({
      data: { ...invoice, status: 'paid' },
      message: 'Payment recorded successfully.',
    });

    expect(component.invoices()[0].status).toBe('paid');
    expect(component.successMessage()).toBe('Payment recorded successfully.');
  });

  it('should not process an invoice that is already paid', () => {
    const invoice = createInvoice(1, 3, 'paid');
    component.invoices.set([invoice]);

    component.markAsPaid(invoice);

    // no request: http.verify() in afterEach would fail otherwise
    expect(component.invoices()[0].status).toBe('paid');
  });

  it('should only call the pay endpoint for a store purchase (the server records the Bookstore income)', () => {
    const invoice = createInvoice(1, 3, 'unpaid', 'Campus store purchase');
    component.invoices.set([invoice]);

    component.markAsPaid(invoice);

    // Exactly one request: the browser no longer writes budget transactions itself.
    http.expectOne(`${API}/1/pay`).flush({ data: { ...invoice, status: 'paid' } });
    http.expectNone('http://localhost:8000/api/transactions');
  });

  it('should show the server message when the payment fails', () => {
    const invoice = createInvoice(1, 3, 'unpaid');
    component.invoices.set([invoice]);

    component.markAsPaid(invoice);

    http
      .expectOne(`${API}/1/pay`)
      .flush(
        { message: 'You do not have permission to access this resource.' },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(component.invoices()[0].status).toBe('unpaid');
    expect(component.errorMessage()).toBe('You do not have permission to access this resource.');
  });
});
