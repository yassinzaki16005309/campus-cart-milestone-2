<?php

namespace Tests\Feature;

use Tests\ApiTestCase;

class ProductTest extends ApiTestCase
{
    public function test_students_and_admins_can_browse_but_accountants_cannot(): void
    {
        $this->product(['name' => 'Notebook']);

        $this->getJson('/api/products')->assertStatus(401);
        $this->actingAs($this->student())->getJson('/api/products')
            ->assertOk()->assertJsonPath('data.0.name', 'Notebook')->assertJsonPath('data.0.price', 100);
        $this->actingAs($this->admin())->getJson('/api/products')->assertOk();
        $this->actingAs($this->accountant())->getJson('/api/products')->assertStatus(403);
    }

    public function test_only_admin_can_change_products(): void
    {
        $payload = ['name' => 'Mug', 'category' => 'Merchandise', 'price' => 80, 'stock' => 5];

        $this->actingAs($this->student())->postJson('/api/products', $payload)->assertStatus(403);

        $admin = $this->admin();
        $id = $this->actingAs($admin)->postJson('/api/products', $payload)->assertCreated()->json('data.id');
        $this->actingAs($admin)->putJson("/api/products/{$id}", ['price' => 90])->assertOk()->assertJsonPath('data.price', 90);
        $this->actingAs($admin)->deleteJson("/api/products/{$id}")->assertOk();
    }

    public function test_a_product_that_was_sold_cannot_be_deleted(): void
    {
        $product = $this->product();
        $this->actingAs($this->student())->postJson('/api/checkout', [
            'items' => [['productId' => $product->id, 'quantity' => 1]], 'paymentOption' => 'pay-now',
        ])->assertCreated();

        $this->actingAs($this->admin())->deleteJson("/api/products/{$product->id}")
            ->assertStatus(409)->assertJsonPath('code', 'product_in_use');
    }

    public function test_product_validation(): void
    {
        $this->actingAs($this->admin())->postJson('/api/products', ['name' => 'X', 'category' => 'Y', 'price' => -1, 'stock' => 1])
            ->assertStatus(422);
        $this->actingAs($this->admin())->postJson('/api/products', ['name' => 'X', 'category' => 'Y', 'price' => 1, 'stock' => -1])
            ->assertStatus(422);
    }
}
