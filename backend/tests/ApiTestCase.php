<?php

namespace Tests;

use App\Models\Employee;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Shared helpers. Tests run on the dedicated MariaDB database "campus_cart_test"
 * (forced in phpunit.xml) because the schema relies on MariaDB constraints.
 */
abstract class ApiTestCase extends TestCase
{
    use RefreshDatabase;

    protected function user(string $role = 'student', array $attributes = []): User
    {
        return User::factory()->state(['role' => $role])->create($attributes);
    }

    protected function admin(): User
    {
        return $this->user('admin');
    }

    protected function accountant(): User
    {
        return $this->user('accountant');
    }

    protected function student(array $attributes = []): User
    {
        return $this->user('student', $attributes);
    }

    protected function product(array $attributes = []): Product
    {
        return Product::create(array_merge([
            'name' => 'Test product '.fake()->unique()->numberBetween(1, 99999),
            'description' => 'A product',
            'category' => 'Books',
            'price' => '100.00',
            'stock' => 10,
            'image_url' => '/images/products/test.png',
        ], $attributes));
    }

    protected function employee(array $attributes = []): Employee
    {
        return Employee::create(array_merge([
            'full_name' => 'Jane Doe',
            'department' => 'Engineering',
            'base_salary' => '10000.00',
            'allowances' => '1000.00',
            'deductions' => '500.00',
        ], $attributes));
    }

    /** Requests that look like they come from the Angular app (Sanctum stateful session). */
    protected function fromSpa(): static
    {
        return $this->withHeaders([
            'Origin' => 'http://localhost:4200',
            'Referer' => 'http://localhost:4200/login',
        ]);
    }
}
