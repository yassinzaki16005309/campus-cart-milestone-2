<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Transaction;
use Tests\ApiTestCase;

class InvoiceTest extends ApiTestCase
{
    private function payload(array $overrides = []): array
    {
        return array_merge(['description' => 'Lab fee', 'amount' => 250, 'dueDate' => '2030-01-31'], $overrides);
    }

    private function manualInvoiceFor($user, array $attributes = []): Invoice
    {
        $invoice = new Invoice(array_merge([
            'student_id' => $user->id, 'description' => 'Manual', 'amount' => '100.00',
            'issue_date' => '2026-11-01', 'due_date' => '2026-12-01',
        ], $attributes));
        $invoice->status = 'unpaid';
        $invoice->save();

        return $invoice;
    }

    public function test_students_only_see_their_own_invoices_staff_see_all(): void
    {
        $alice = $this->student();
        $bob = $this->student();
        $this->manualInvoiceFor($alice);
        $this->manualInvoiceFor($bob);

        $this->actingAs($alice)->getJson('/api/invoices')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.studentId', $alice->id);
        $this->actingAs($this->accountant())->getJson('/api/invoices')->assertOk()->assertJsonCount(2, 'data');
        $this->actingAs($this->admin())->getJson('/api/invoices')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_a_student_cannot_view_or_pay_someone_elses_invoice(): void
    {
        $alice = $this->student();
        $bob = $this->student();
        $invoice = $this->manualInvoiceFor($bob);

        $this->actingAs($alice)->getJson("/api/invoices/{$invoice->id}")->assertStatus(403);
        $this->actingAs($alice)->postJson("/api/invoices/{$invoice->id}/pay")->assertStatus(403);
        $this->assertSame('unpaid', $invoice->fresh()->status);
    }

    public function test_creating_an_invoice_assigns_it_to_the_creator_like_milestone_1(): void
    {
        $alice = $this->student();
        $other = $this->student();

        // A student cannot target someone else, even by sending studentId.
        $this->actingAs($alice)->postJson('/api/invoices', $this->payload(['studentId' => $other->id]))
            ->assertCreated()
            ->assertJsonPath('data.studentId', $alice->id)
            ->assertJsonPath('data.status', 'unpaid')
            ->assertJsonPath('data.orderId', null)
            ->assertJsonPath('message', 'Invoice created successfully.');

        // Staff default to themselves ...
        $accountant = $this->accountant();
        $this->actingAs($accountant)->postJson('/api/invoices', $this->payload())
            ->assertCreated()->assertJsonPath('data.studentId', $accountant->id);

        // ... and may optionally target a student.
        $this->actingAs($accountant)->postJson('/api/invoices', $this->payload(['studentId' => $other->id]))
            ->assertCreated()->assertJsonPath('data.studentId', $other->id);

        $this->actingAs($accountant)->postJson('/api/invoices', $this->payload(['studentId' => 999999]))
            ->assertStatus(422)->assertJsonPath('code', 'student_not_found');
    }

    public function test_m1_validation_messages(): void
    {
        $alice = $this->student();

        foreach ([['description' => ''], ['amount' => 0], ['amount' => -3], ['amount' => null]] as $bad) {
            $this->actingAs($alice)->postJson('/api/invoices', $this->payload($bad))
                ->assertStatus(422)->assertJsonPath('message', 'Please enter a description and a valid amount.');
        }

        $this->actingAs($alice)->postJson('/api/invoices', $this->payload(['dueDate' => '']))
            ->assertStatus(422)->assertJsonPath('message', 'Please select a due date.');
    }

    public function test_paying_a_manual_invoice_records_no_income_like_milestone_1(): void
    {
        $alice = $this->student();
        $invoice = $this->manualInvoiceFor($alice);

        $this->actingAs($alice)->postJson("/api/invoices/{$invoice->id}/pay")
            ->assertOk()
            ->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('message', 'Payment recorded successfully.');

        $this->assertSame(0, Transaction::count());
        $this->assertNotNull($invoice->fresh()->paid_at);
    }

    public function test_paying_twice_is_a_harmless_no_op(): void
    {
        $alice = $this->student();
        $invoice = $this->manualInvoiceFor($alice);

        $this->actingAs($alice)->postJson("/api/invoices/{$invoice->id}/pay")->assertOk();
        $this->actingAs($alice)->postJson("/api/invoices/{$invoice->id}/pay")
            ->assertOk()->assertJsonPath('message', 'This invoice is already paid.');
    }

    public function test_only_staff_can_edit_or_delete_and_only_unpaid_manual_invoices(): void
    {
        $alice = $this->student();
        $invoice = $this->manualInvoiceFor($alice);
        $accountant = $this->accountant();

        $this->actingAs($alice)->putJson("/api/invoices/{$invoice->id}", ['amount' => 5])->assertStatus(403);
        $this->actingAs($alice)->deleteJson("/api/invoices/{$invoice->id}")->assertStatus(403);

        $this->actingAs($accountant)->putJson("/api/invoices/{$invoice->id}", ['amount' => 175, 'description' => 'Edited'])
            ->assertOk()->assertJsonPath('data.amount', 175)->assertJsonPath('data.description', 'Edited');

        // paid invoices are payment history: protected
        $this->actingAs($alice)->postJson("/api/invoices/{$invoice->id}/pay")->assertOk();
        $this->actingAs($accountant)->putJson("/api/invoices/{$invoice->id}", ['amount' => 1])
            ->assertStatus(409)->assertJsonPath('code', 'invoice_protected');
        $this->actingAs($accountant)->deleteJson("/api/invoices/{$invoice->id}")->assertStatus(409);

        // an unpaid manual invoice can be deleted
        $other = $this->manualInvoiceFor($alice);
        $this->actingAs($accountant)->deleteJson("/api/invoices/{$other->id}")->assertOk();
        $this->assertDatabaseMissing('invoices', ['id' => $other->id]);
    }

    public function test_store_invoices_cannot_be_edited_or_deleted(): void
    {
        $student = $this->student();
        $product = $this->product();
        $invoiceId = $this->actingAs($student)->postJson('/api/checkout', [
            'items' => [['productId' => $product->id, 'quantity' => 1]], 'paymentOption' => 'add-to-invoice',
        ])->assertCreated()->json('data.invoiceId');

        $accountant = $this->accountant();
        $this->actingAs($accountant)->putJson("/api/invoices/{$invoiceId}", ['amount' => 1])->assertStatus(409);
        $this->actingAs($accountant)->deleteJson("/api/invoices/{$invoiceId}")->assertStatus(409);
    }
}
