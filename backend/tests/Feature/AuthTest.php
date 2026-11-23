<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\ApiTestCase;

class AuthTest extends ApiTestCase
{
    private function signupPayload(array $overrides = []): array
    {
        return array_merge([
            'username' => 'newstudent',
            'fullName' => 'New Student',
            'email' => 'new@student.test',
            'password' => 'Secret123',
            'pictureUrl' => '',
            'creditCard' => '4111 1111 1111 1234',
            'preferences' => ['Books', 'Merch'],
        ], $overrides);
    }

    public function test_register_creates_a_student_hashes_the_password_and_logs_in(): void
    {
        $response = $this->fromSpa()->postJson('/api/register', $this->signupPayload(['role' => 'admin']));

        $response->assertCreated()
            ->assertJsonPath('data.role', 'student') // the role can never be chosen by the client
            ->assertJsonPath('data.fullName', 'New Student')
            ->assertJsonPath('data.creditCardLast4', '1234')
            ->assertJsonPath('data.preferences', ['Books', 'Merch']);

        $user = User::where('username', 'newstudent')->firstOrFail();
        $this->assertNotSame('Secret123', $user->password);
        $this->assertTrue(Hash::check('Secret123', $user->password));
        $this->assertAuthenticatedAs($user, 'web');
    }

    public function test_register_rejects_a_duplicate_username_or_email_with_the_m1_message(): void
    {
        $this->student(['username' => 'taken', 'email' => 'taken@x.test']);

        $this->fromSpa()->postJson('/api/register', $this->signupPayload(['username' => 'taken']))
            ->assertStatus(422)
            ->assertJsonPath('message', 'Username or email already exists, or password is invalid.');

        $this->fromSpa()->postJson('/api/register', $this->signupPayload(['email' => 'taken@x.test']))
            ->assertStatus(422)
            ->assertJsonPath('message', 'Username or email already exists, or password is invalid.');
    }

    public function test_register_rejects_a_blank_password(): void
    {
        $this->fromSpa()->postJson('/api/register', $this->signupPayload(['password' => '   ']))
            ->assertStatus(422)
            ->assertJsonPath('message', 'Username or email already exists, or password is invalid.');
    }

    public function test_login_succeeds_and_the_server_sets_the_remember_cookie(): void
    {
        $this->student(['username' => 'alice']);

        $this->fromSpa()->postJson('/api/login', [
            'username' => 'alice', 'password' => 'password', 'rememberMe' => true,
        ])
            ->assertOk()
            ->assertJsonPath('data.username', 'alice')
            ->assertCookie('campusCartRememberedUsername', 'alice', false);

        $this->assertAuthenticated('web');
    }

    public function test_login_without_remember_me_clears_the_cookie(): void
    {
        $this->student(['username' => 'alice']);

        $this->fromSpa()->postJson('/api/login', ['username' => 'alice', 'password' => 'password'])
            ->assertOk()
            ->assertCookieExpired('campusCartRememberedUsername');
    }

    public function test_login_with_wrong_credentials_returns_the_m1_message(): void
    {
        $this->student(['username' => 'alice']);

        $this->fromSpa()->postJson('/api/login', ['username' => 'alice', 'password' => 'nope'])
            ->assertStatus(401)
            ->assertJsonPath('message', 'Invalid username or password.');

        $this->assertGuest('web');
    }

    public function test_usernames_are_case_sensitive_like_milestone_1(): void
    {
        $this->student(['username' => 'alice']);

        $this->fromSpa()->postJson('/api/login', ['username' => 'ALICE', 'password' => 'password'])
            ->assertStatus(401);
    }

    public function test_login_requires_a_spa_session(): void
    {
        $this->student(['username' => 'alice']);

        $this->postJson('/api/login', ['username' => 'alice', 'password' => 'password'])
            ->assertStatus(400)
            ->assertJsonPath('code', 'session_required');
    }

    public function test_logout_ends_the_session(): void
    {
        $user = $this->student();

        $this->actingAs($user)->fromSpa()->postJson('/api/logout')->assertOk();

        $this->assertGuest('web');
    }

    public function test_me_requires_authentication_and_returns_json(): void
    {
        $this->getJson('/api/me')->assertStatus(401)->assertJsonPath('message', 'Unauthenticated.');

        $user = $this->student();
        $this->actingAs($user)->getJson('/api/me')->assertOk()->assertJsonPath('data.id', $user->id);
    }

    public function test_unknown_api_pages_and_records_return_friendly_404_messages(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->getJson('/api/does-not-exist')
            ->assertStatus(404)->assertJsonPath('message', 'Page not found.');

        $this->actingAs($admin)->getJson('/api/employees/999999')
            ->assertStatus(404)->assertJsonPath('message', 'The requested record was not found.');
    }

    public function test_wrong_method_returns_a_json_405(): void
    {
        $this->actingAs($this->admin())->deleteJson('/api/me')->assertStatus(405);
    }
}
