<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\ApiTestCase;

class ProfileTest extends ApiTestCase
{
    public function test_profile_can_be_retrieved_and_updated(): void
    {
        $user = $this->student();

        $this->actingAs($user)->getJson('/api/profile')
            ->assertOk()->assertJsonPath('data.username', $user->username);

        $this->actingAs($user)->putJson('/api/profile', [
            'fullName' => 'Renamed Student',
            'creditCard' => '5555 4444 3333 9876',
            'preferences' => ['Books'],
        ])
            ->assertOk()
            ->assertJsonPath('data.fullName', 'Renamed Student')
            ->assertJsonPath('data.creditCardLast4', '9876')
            ->assertJsonPath('message', 'Profile updated successfully.');
    }

    public function test_profile_update_rejects_an_email_used_by_someone_else(): void
    {
        $other = $this->student();
        $user = $this->student();

        $this->actingAs($user)->putJson('/api/profile', ['email' => $other->email])
            ->assertStatus(422);
    }

    public function test_the_role_cannot_be_changed_through_the_profile(): void
    {
        $user = $this->student();

        $this->actingAs($user)->putJson('/api/profile', ['role' => 'admin', 'fullName' => 'Sneaky'])->assertOk();

        $this->assertSame('student', $user->fresh()->role);
    }

    public function test_deleting_a_profile_is_refused_while_invoices_are_unpaid(): void
    {
        $user = $this->student();
        $this->actingAs($user)->postJson('/api/invoices', [
            'description' => 'Lab fee', 'amount' => 250, 'dueDate' => '2030-01-01',
        ])->assertCreated();

        $this->actingAs($user)->deleteJson('/api/profile')
            ->assertStatus(409)
            ->assertJsonPath('code', 'unpaid_invoices');

        $this->assertNull($user->fresh()->deleted_at);
    }

    public function test_deleting_a_profile_soft_deletes_anonymizes_and_revokes_access_but_keeps_history(): void
    {
        $user = $this->student(['username' => 'leaver', 'email' => 'leaver@x.test']);

        // History that must survive: a paid invoice.
        $invoiceId = $this->actingAs($user)->postJson('/api/invoices', [
            'description' => 'Old fee', 'amount' => 100, 'dueDate' => '2030-01-01',
        ])->json('data.id');
        $this->actingAs($user)->postJson("/api/invoices/{$invoiceId}/pay")->assertOk();

        $user->createToken('device');
        DB::table('sessions')->insert([
            'id' => 'session-of-leaver', 'user_id' => $user->id, 'payload' => 'x', 'last_activity' => time(),
        ]);

        $this->actingAs($user)->fromSpa()->deleteJson('/api/profile')->assertOk();

        // Soft deleted + anonymized
        $row = User::withTrashed()->findOrFail($user->id);
        $this->assertNotNull($row->deleted_at);
        $this->assertSame('Deleted user', $row->name);
        $this->assertSame("deleted_{$user->id}", $row->username);
        $this->assertNull($row->credit_card_last4);

        // Every way of staying logged in is revoked
        $this->assertSame(0, $row->tokens()->count());
        $this->assertSame(0, DB::table('sessions')->where('user_id', $user->id)->count());

        // History preserved
        $this->assertSame(1, Invoice::where('student_id', $user->id)->count());

        // Cannot log in any more, with the old or the placeholder identity
        $this->fromSpa()->postJson('/api/login', ['username' => 'leaver', 'password' => 'password'])->assertStatus(401);
        $this->fromSpa()->postJson('/api/login', ['username' => "deleted_{$user->id}", 'password' => 'password'])->assertStatus(401);

        // Username and email are free again
        $this->fromSpa()->postJson('/api/register', [
            'username' => 'leaver', 'fullName' => 'Back Again', 'email' => 'leaver@x.test', 'password' => 'Secret123',
        ])->assertCreated();
    }

    public function test_a_soft_deleted_users_old_token_no_longer_works(): void
    {
        $user = $this->student();
        $plain = $user->createToken('device')->plainTextToken;

        $this->actingAs($user)->deleteJson('/api/profile')->assertOk();
        $this->app['auth']->forgetGuards();

        $this->withToken($plain)->getJson('/api/me')->assertStatus(401);
    }
}
