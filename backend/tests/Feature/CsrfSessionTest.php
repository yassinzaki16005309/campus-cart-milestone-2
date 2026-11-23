<?php

namespace Tests\Feature;

use PHPUnit\Framework\Attributes\DataProvider;
use Tests\ApiTestCase;

/**
 * CSRF protection for the Angular (Sanctum cookie) requests.
 *
 * Laravel skips CSRF validation while the environment is "testing", so every test
 * here switches the environment to "local" first: the checks below run exactly as
 * they do in the browser.
 */
class CsrfSessionTest extends ApiTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->app['env'] = 'local';
    }

    /** The four write verbs ({id} is replaced by a real employee id in each test). */
    public static function writeRequests(): array
    {
        return [
            'POST' => ['POST', '/api/employees'],
            'PUT' => ['PUT', '/api/employees/{id}'],
            'PATCH' => ['PATCH', '/api/employees/{id}'],
            'DELETE' => ['DELETE', '/api/employees/{id}'],
        ];
    }

    /** Creates an employee and returns the URI with its real id. */
    private function uriWithEmployee(string $uri): string
    {
        return str_replace('{id}', (string) $this->employee()->id, $uri);
    }

    private function payload(): array
    {
        return [
            'fullName' => 'Layla Samir', 'department' => 'Library',
            'baseSalary' => 8000, 'allowances' => 300, 'deductions' => 100,
        ];
    }

    #[DataProvider('writeRequests')]
    public function test_a_write_with_a_wrong_csrf_token_is_rejected_with_a_clear_419(string $method, string $uri): void
    {
        $uri = $this->uriWithEmployee($uri);

        $this->actingAs($this->admin())
            ->withSession(['_token' => 'the-real-token'])
            ->fromSpa()
            ->withHeader('X-CSRF-TOKEN', 'a-forged-or-stale-token')
            ->json($method, $uri, $this->payload())
            ->assertStatus(419)
            ->assertJsonPath('code', 'csrf_token_mismatch')
            ->assertJsonPath('message', 'Your request could not be verified. Please reload the page and try again.');

        $this->assertDatabaseMissing('employees', ['full_name' => 'Layla Samir']);
    }

    #[DataProvider('writeRequests')]
    public function test_a_write_without_any_csrf_token_is_rejected(string $method, string $uri): void
    {
        $uri = $this->uriWithEmployee($uri);

        $this->actingAs($this->admin())
            ->withSession(['_token' => 'the-real-token'])
            ->fromSpa()
            ->json($method, $uri, $this->payload())
            ->assertStatus(419)
            ->assertJsonPath('code', 'csrf_token_mismatch');
    }

    /** Protection is intact (not disabled): the very same writes pass with the right token. */
    #[DataProvider('writeRequests')]
    public function test_the_same_write_succeeds_with_the_correct_csrf_token(string $method, string $uri): void
    {
        $uri = $this->uriWithEmployee($uri);

        $response = $this->actingAs($this->admin())
            ->withSession(['_token' => 'the-real-token'])
            ->fromSpa()
            ->withHeader('X-CSRF-TOKEN', 'the-real-token')
            ->json($method, $uri, $this->payload());

        $this->assertNotSame(419, $response->status());
        $response->assertSuccessful();
    }

    public function test_login_is_csrf_protected_too(): void
    {
        $this->student(['username' => 'alice']);

        $this->withSession(['_token' => 'the-real-token'])->fromSpa()
            ->withHeader('X-CSRF-TOKEN', 'wrong')
            ->postJson('/api/login', ['username' => 'alice', 'password' => 'password'])
            ->assertStatus(419)
            ->assertJsonPath('code', 'csrf_token_mismatch');

        $this->assertGuest('web');
    }

    /**
     * ROOT CAUSE: the CSRF check runs BEFORE authentication. With an expired session
     * Laravel starts an empty session (new token) while the browser still sends the old
     * token, so a write answers 419, not 401. At the CSRF layer an expired session and a
     * forged token cannot be told apart.
     */
    public function test_an_expired_session_answers_419_for_writes_before_authentication_runs(): void
    {
        // No session, no login: this is what the server sees after the session expired.
        $this->fromSpa()
            ->withHeader('X-CSRF-TOKEN', 'token-of-the-expired-session')
            ->postJson('/api/invoices', ['description' => 'x', 'amount' => 10, 'dueDate' => '2030-01-01'])
            ->assertStatus(419)
            ->assertJsonPath('code', 'csrf_token_mismatch');
    }

    /**
     * ...whereas a READ is not CSRF-checked, so GET /api/me gives the authoritative
     * answer. The Angular interceptor uses exactly this to tell "session expired" (401)
     * from "token merely stale" (200).
     */
    public function test_a_read_after_expiry_gives_the_authoritative_401(): void
    {
        $this->fromSpa()->getJson('/api/me')
            ->assertStatus(401)
            ->assertJsonPath('message', 'Unauthenticated.');
    }

    public function test_a_valid_session_is_reported_by_the_same_read(): void
    {
        $user = $this->student();

        $this->actingAs($user)->fromSpa()->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id);
    }

    public function test_the_csrf_cookie_endpoint_issues_a_fresh_token_cookie(): void
    {
        $this->fromSpa()->get('/sanctum/csrf-cookie')
            ->assertNoContent()
            ->assertCookie('XSRF-TOKEN');
    }
}
