<?php

namespace Tests\Feature;

use App\Models\Transaction;
use Tests\ApiTestCase;

class TransactionTest extends ApiTestCase
{
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'department' => 'IT', 'type' => 'expense', 'amount' => 250.5,
            'date' => '2026-11-20', 'description' => 'Server licences',
        ], $overrides);
    }

    public function test_only_admin_and_accountant_can_manage_the_budget(): void
    {
        $this->getJson('/api/transactions')->assertStatus(401);
        $this->actingAs($this->student())->getJson('/api/transactions')->assertStatus(403);
        $this->actingAs($this->student())->postJson('/api/transactions', $this->payload())->assertStatus(403);
        $this->actingAs($this->accountant())->getJson('/api/transactions')->assertOk();
    }

    public function test_manual_transactions_have_full_crud(): void
    {
        $accountant = $this->accountant();

        $id = $this->actingAs($accountant)->postJson('/api/transactions', $this->payload())
            ->assertCreated()->assertJsonPath('data.orderId', null)->json('data.id');

        $this->actingAs($accountant)->putJson("/api/transactions/{$id}", ['amount' => 300])
            ->assertOk()->assertJsonPath('data.amount', 300);

        $this->actingAs($accountant)->deleteJson("/api/transactions/{$id}")->assertOk();
        $this->assertDatabaseMissing('transactions', ['id' => $id]);
    }

    public function test_department_filter(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin)->postJson('/api/transactions', $this->payload(['department' => 'IT']));
        $this->actingAs($admin)->postJson('/api/transactions', $this->payload(['department' => 'Library']));

        $this->actingAs($admin)->getJson('/api/transactions?department=Library')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.department', 'Library');
    }

    public function test_m1_validation(): void
    {
        $admin = $this->admin();
        $message = 'Please enter a positive amount, a date and a description.';

        foreach ([['amount' => 0], ['amount' => -5], ['amount' => null], ['date' => ''], ['description' => '   ']] as $bad) {
            $this->actingAs($admin)->postJson('/api/transactions', $this->payload($bad))
                ->assertStatus(422)->assertJsonPath('message', $message);
        }

        $this->actingAs($admin)->postJson('/api/transactions', $this->payload(['department' => 'Cafeteria']))
            ->assertStatus(422);
        $this->actingAs($admin)->postJson('/api/transactions', $this->payload(['type' => 'gift']))
            ->assertStatus(422);
    }

    public function test_order_id_in_a_request_is_ignored(): void
    {
        $id = $this->actingAs($this->admin())
            ->postJson('/api/transactions', $this->payload(['orderId' => 1, 'order_id' => 1]))
            ->assertCreated()->json('data.id');

        $this->assertNull(Transaction::findOrFail($id)->order_id);
    }

    public function test_store_income_cannot_be_updated_or_deleted(): void
    {
        $student = $this->student();
        $product = $this->product(['price' => '120.00']);

        // pay-now purchase => income row linked to its order
        $this->actingAs($student)->postJson('/api/checkout', [
            'items' => [['productId' => $product->id, 'quantity' => 1]], 'paymentOption' => 'pay-now',
        ])->assertCreated();

        $income = Transaction::firstOrFail();
        $this->assertNotNull($income->order_id);

        $accountant = $this->accountant();

        // 409 even with an invalid body: the protection check runs before validation
        $this->actingAs($accountant)->putJson("/api/transactions/{$income->id}", ['amount' => -1])
            ->assertStatus(409)->assertJsonPath('code', 'transaction_protected');
        $this->actingAs($accountant)->patchJson("/api/transactions/{$income->id}", ['description' => 'edited'])
            ->assertStatus(409);
        $this->actingAs($accountant)->deleteJson("/api/transactions/{$income->id}")
            ->assertStatus(409)
            ->assertJsonPath('message', 'This transaction was created by a store purchase and cannot be modified or deleted.');

        $this->assertDatabaseHas('transactions', ['id' => $income->id, 'description' => 'Campus store purchase']);
    }
}
