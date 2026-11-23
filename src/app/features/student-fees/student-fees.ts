import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Invoice } from '../../core/models/invoice.model';
import { apiErrorMessage } from '../../core/services/api-error';
import { InvoiceApi } from '../../core/services/invoice-api';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-student-fees',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './student-fees.html',
  styleUrl: './student-fees.css',
})
export class StudentFees {
  private api = inject(InvoiceApi);
  private auth = inject(Auth);

  // Loaded from the Laravel API (a student only receives their own invoices).
  invoices = signal<Invoice[]>([]);

  description = '';
  amount: number | null = null;
  dueDate = this.getDefaultDueDate();

  errorMessage = signal('');
  successMessage = signal('');

  // Show only the logged-in student's invoices.
  // Admins and accountants can see all invoices.
  myInvoices = computed(() => {
    const user = this.auth.currentUser();

    if (!user) {
      return [];
    }

    if (user.role === 'admin' || user.role === 'accountant') {
      return this.invoices();
    }
    return this.invoices().filter((invoice) => invoice.studentId === user.id);
  });

  unpaidInvoices = computed(() =>
    this.myInvoices().filter((invoice) => invoice.status === 'unpaid'),
  );

  paidInvoices = computed(() => this.myInvoices().filter((invoice) => invoice.status === 'paid'));

  constructor() {
    this.api.list().subscribe({
      next: (invoices) => this.invoices.set(invoices),
      error: (error) => this.errorMessage.set(apiErrorMessage(error)),
    });
  }

  // Create a new invoice
  createInvoice(): void {
    const user = this.auth.currentUser();

    if (!user) {
      this.errorMessage.set('Please log in first.');
      return;
    }

    if (!this.description.trim() || !this.amount || this.amount <= 0) {
      this.errorMessage.set('Please enter a description and a valid amount.');
      return;
    }

    if (!this.dueDate) {
      this.errorMessage.set('Please select a due date.');
      return;
    }

    this.api
      .create({
        description: this.description.trim(),
        amount: this.amount,
        dueDate: this.dueDate,
      })
      .subscribe({
        next: (invoice) => {
          this.invoices.update((list) => [...list, invoice]);

          this.description = '';
          this.amount = null;
          this.dueDate = this.getDefaultDueDate();

          this.errorMessage.set('');
          this.successMessage.set('Invoice created successfully.');
        },
        error: (error) => {
          this.successMessage.set('');
          this.errorMessage.set(apiErrorMessage(error));
        },
      });
  }

  // Mark an unpaid invoice as paid.
  // For a store purchase the server also records the Bookstore income (exactly once).
  markAsPaid(invoice: Invoice): void {
    if (invoice.status === 'paid') {
      return;
    }

    this.api.pay(invoice.id).subscribe({
      next: (paidInvoice) => {
        this.invoices.update((list) =>
          list.map((item) => (item.id === paidInvoice.id ? paidInvoice : item)),
        );

        this.errorMessage.set('');
        this.successMessage.set('Payment recorded successfully.');
      },
      error: (error) => {
        this.successMessage.set('');
        this.errorMessage.set(apiErrorMessage(error));
      },
    });
  }

  private getDefaultDueDate(): string {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const year = dueDate.getFullYear();
    const month = String(dueDate.getMonth() + 1).padStart(2, '0');
    const day = String(dueDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
