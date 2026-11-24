<?php

namespace Tests\Feature;

use App\Mail\RegistrationConfirmation;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Tests\ApiTestCase;

/** Milestone 2 bonus: a confirmation email after a successful signup. */
class RegistrationEmailTest extends ApiTestCase
{
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'username' => 'newstudent',
            'fullName' => 'New Student',
            'email' => 'new@student.test',
            'password' => 'Secret123',
            'pictureUrl' => '',
            'creditCard' => '4111 1111 1111 1234',
            'preferences' => ['Textbooks', 'Lab Coats'],
        ], $overrides);
    }

    public function test_a_successful_signup_sends_one_confirmation_to_the_new_address(): void
    {
        Mail::fake();

        $this->fromSpa()->postJson('/api/register', $this->payload())
            ->assertCreated()
            ->assertJsonPath(
                'message',
                'Account created successfully. A confirmation email has been sent to new@student.test.'
            );

        Mail::assertSent(RegistrationConfirmation::class, 1);
        Mail::assertSent(
            RegistrationConfirmation::class,
            fn (RegistrationConfirmation $mail) => $mail->hasTo('new@student.test')
                && $mail->user->username === 'newstudent'
        );
    }

    public function test_a_signup_without_interests_still_gets_a_confirmation(): void
    {
        Mail::fake();

        $this->fromSpa()->postJson('/api/register', $this->payload(['preferences' => []]))
            ->assertCreated();

        Mail::assertSent(RegistrationConfirmation::class, 1);
    }

    public function test_a_rejected_signup_sends_nothing(): void
    {
        Mail::fake();
        $this->student(['username' => 'taken', 'email' => 'taken@x.test']);

        $this->fromSpa()->postJson('/api/register', $this->payload(['username' => 'taken']))
            ->assertStatus(422);
        $this->fromSpa()->postJson('/api/register', $this->payload(['email' => 'taken@x.test']))
            ->assertStatus(422);
        $this->fromSpa()->postJson('/api/register', $this->payload(['password' => '   ']))
            ->assertStatus(422);

        Mail::assertNothingSent();
    }

    public function test_editing_the_profile_does_not_send_the_signup_email_again(): void
    {
        Mail::fake();
        $student = $this->student();

        $this->actingAs($student)->putJson('/api/profile', ['fullName' => 'Renamed'])->assertOk();

        Mail::assertNothingSent();
    }

    public function test_a_mail_failure_never_fails_the_signup_and_the_user_is_told(): void
    {
        Mail::shouldReceive('to')->once()->andThrow(new \RuntimeException('Mail server unreachable'));

        $this->fromSpa()->postJson('/api/register', $this->payload())
            ->assertCreated()
            ->assertJsonPath(
                'message',
                'Account created successfully. We could not send the confirmation email right now.'
            );

        $user = User::where('username', 'newstudent')->firstOrFail();
        $this->assertAuthenticatedAs($user, 'web');
    }

    public function test_the_email_names_the_account_lists_the_interests_and_links_to_login(): void
    {
        $user = $this->student([
            'name' => 'New Student',
            'username' => 'newstudent',
            'preferences' => ['Textbooks', 'Lab Coats'],
        ]);

        $mail = new RegistrationConfirmation($user);

        $mail->assertHasSubject('Welcome to CampusCart - your account is ready');
        $mail->assertFrom((string) config('mail.from.address'), 'CampusCart');
        foreach (['New Student', 'newstudent', 'Textbooks', 'Lab Coats'] as $expected) {
            $mail->assertSeeInHtml($expected);
            $mail->assertSeeInText($expected);
        }
        $mail->assertSeeInHtml(rtrim((string) config('app.frontend_url'), '/').'/login', false);
    }

    public function test_the_email_says_so_when_no_interests_were_chosen(): void
    {
        $mail = new RegistrationConfirmation($this->student(['preferences' => []]));

        $mail->assertSeeInHtml('You have not selected any interests yet.');
        $mail->assertSeeInText('You have not selected any interests yet.');
    }

    public function test_the_email_never_contains_the_password_or_card_details(): void
    {
        $user = $this->student(['password' => 'Secret123', 'credit_card_last4' => '1234']);

        $html = (new RegistrationConfirmation($user))->render();

        $this->assertStringNotContainsString('Secret123', $html);
        $this->assertStringNotContainsString((string) $user->password, $html); // the stored hash
        $this->assertStringNotContainsString('1234', $html);
    }

    public function test_user_supplied_text_cannot_inject_html_into_the_email(): void
    {
        $user = $this->student(['name' => '<script>alert(1)</script>', 'preferences' => ['<b>x</b>']]);

        $mail = new RegistrationConfirmation($user);

        $mail->assertDontSeeInHtml('<script>alert(1)</script>', false);
        $mail->assertDontSeeInHtml('<b>x</b>', false);
        $mail->assertSeeInHtml('<script>alert(1)</script>'); // present, but escaped
    }
}
