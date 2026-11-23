<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;

class AuthController extends Controller
{
    /** Same cookie name the Angular login form already reads (Milestone 1). */
    public const REMEMBER_COOKIE = 'campusCartRememberedUsername';

    /** Insert a profile: Milestone 1 signup. Always creates a student and logs them in. */
    public function register(RegisterRequest $request): JsonResponse
    {
        $this->requireSession($request);

        $digits = preg_replace('/\D/', '', (string) $request->input('creditCard'));

        $user = new User([
            'name' => $request->input('fullName'),
            'username' => $request->input('username'),
            'email' => $request->input('email'),
            'password' => $request->input('password'), // hashed by the model cast
            'picture_url' => $request->input('pictureUrl') ?: null,
            'preferences' => $request->input('preferences') ?? [],
            'credit_card_last4' => strlen($digits) >= 4 ? substr($digits, -4) : null,
        ]);
        $user->role = 'student';

        try {
            $user->save();
        } catch (UniqueConstraintViolationException) {
            // Two simultaneous signups with the same username/email.
            throw new ApiException('Username or email already exists, or password is invalid.', 422);
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return (new UserResource($user))
            ->additional(['message' => 'Account created successfully.'])
            ->response()
            ->setStatusCode(201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $this->requireSession($request);

        $username = (string) $request->input('username');

        $loggedIn = Auth::guard('web')->attempt([
            'username' => $username,
            'password' => (string) $request->input('password'),
        ]);

        if (! $loggedIn) {
            throw new ApiException('Invalid username or password.', 401, 'invalid_credentials');
        }

        $request->session()->regenerate();

        // Server-initialised cookie (Milestone 1 "Remember my username"): the username
        // only, never the password. Readable by the Angular form (not HttpOnly), 30 days.
        $cookie = $request->boolean('rememberMe')
            ? cookie(self::REMEMBER_COOKIE, $username, 60 * 24 * 30, '/', null, null, false, false, 'lax')
            : Cookie::forget(self::REMEMBER_COOKIE);

        return (new UserResource(Auth::guard('web')->user()))
            ->additional(['message' => 'Logged in successfully.'])
            ->response()
            ->withCookie($cookie);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['message' => 'Logged out successfully.']);
    }

    /** Lets Angular restore the session after a page reload. */
    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    /**
     * Login/registration use the Sanctum cookie session, which exists only for
     * requests coming from the SPA origin (or with a matching Origin/Referer header).
     */
    private function requireSession(Request $request): void
    {
        if (! $request->hasSession()) {
            throw new ApiException(
                'A browser session is required. Send the request from the CampusCart frontend (Origin/Referer header).',
                400,
                'session_required'
            );
        }
    }
}
