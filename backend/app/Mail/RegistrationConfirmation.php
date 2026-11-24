<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Confirmation email sent once after a successful signup (Milestone 2 bonus).
 *
 * It names the account and lists the interests the user picked. It never carries a
 * password, a card number or any other secret. It is sent immediately (not queued),
 * so no queue worker is needed.
 */
class RegistrationConfirmation extends Mailable
{
    public function __construct(public readonly User $user)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address((string) config('mail.from.address'), 'CampusCart'),
            subject: 'Welcome to CampusCart - your account is ready',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.registration-confirmation',
            text: 'emails.registration-confirmation-text',
            with: [
                'name' => $this->user->name,
                'username' => $this->user->username,
                'interests' => $this->user->preferences ?? [],
                'loginUrl' => rtrim((string) config('app.frontend_url'), '/').'/login',
            ],
        );
    }
}
