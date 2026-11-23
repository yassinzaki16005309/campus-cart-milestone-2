<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\ApiTestCase;

class SeederTest extends ApiTestCase
{
    public function test_seeding_creates_the_milestone_1_demo_data(): void
    {
        $this->seed();

        $this->assertSame(3, User::count());
        $this->assertSame(4, Employee::count());
        $this->assertSame(6, Product::count());

        foreach ([['admin', 'Admin123', 'admin'], ['accountant', 'Account123', 'accountant'], ['student', 'Student123', 'student']] as [$username, $password, $role]) {
            $this->fromSpa()->postJson('/api/login', ['username' => $username, 'password' => $password])
                ->assertOk()->assertJsonPath('data.role', $role);
        }
    }

    public function test_seeding_twice_creates_no_duplicates(): void
    {
        $this->seed();
        $this->seed();

        $this->assertSame(3, User::count());
        $this->assertSame(4, Employee::count());
        $this->assertSame(6, Product::count());
    }

    public function test_reseeding_never_overwrites_passwords_roles_prices_or_stock(): void
    {
        $this->seed();

        $admin = User::where('username', 'admin')->firstOrFail();
        $admin->password = 'ChangedPassword9';
        $admin->save();
        $hashBefore = $admin->fresh()->password;

        $hoodie = Product::where('name', 'Campus Hoodie')->firstOrFail();
        $hoodie->update(['stock' => 3, 'price' => '999.00']);

        Employee::where('full_name', 'Ahmed Hassan')->update(['base_salary' => 1]);

        $this->seed();

        $this->assertSame($hashBefore, $admin->fresh()->password);
        $this->assertTrue(Hash::check('ChangedPassword9', $admin->fresh()->password));
        $this->assertFalse(Hash::check('Admin123', $admin->fresh()->password));
        $this->assertSame(3, $hoodie->fresh()->stock);
        $this->assertSame('999.00', $hoodie->fresh()->price);
        $this->assertSame('1.00', Employee::where('full_name', 'Ahmed Hassan')->first()->base_salary);
    }

    public function test_an_existing_user_with_a_demo_email_is_not_modified_or_duplicated(): void
    {
        $existing = $this->student(['username' => 'someone_else', 'email' => 'admin@campuscart.com']);
        $before = $existing->fresh()->only(['username', 'email', 'password', 'role']);

        $this->seed();

        $this->assertSame($before, $existing->fresh()->only(['username', 'email', 'password', 'role']));
        $this->assertSame(1, User::where('email', 'admin@campuscart.com')->count());
        $this->assertSame(0, User::where('username', 'admin')->count()); // skipped, not forced
    }
}
