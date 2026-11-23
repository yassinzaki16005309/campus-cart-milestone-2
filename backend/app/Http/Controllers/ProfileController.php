<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\MapsInput;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Services\UserDeletionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;

/** Profile retrieve / update / delete for the logged-in user (insert = AuthController@register). */
class ProfileController extends Controller
{
    use MapsInput;

    public function show(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();

        $user->fill($this->mapInput($request, [
            'fullName' => 'name',
            'email' => 'email',
            'pictureUrl' => 'picture_url',
            'preferences' => 'preferences',
        ]));

        if ($request->exists('creditCard')) {
            $digits = preg_replace('/\D/', '', (string) $request->input('creditCard'));
            $user->credit_card_last4 = strlen($digits) >= 4 ? substr($digits, -4) : null;
        }

        if ($user->preferences === null) {
            $user->preferences = [];
        }

        $user->save();

        return (new UserResource($user))
            ->additional(['message' => 'Profile updated successfully.'])
            ->response();
    }

    /** Soft delete + anonymize. 409 while unpaid invoices exist. */
    public function destroy(Request $request, UserDeletionService $deletion): JsonResponse
    {
        $deletion->delete($request->user());

        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()
            ->json(['message' => 'Your account has been deleted.'])
            ->withCookie(Cookie::forget(AuthController::REMEMBER_COOKIE));
    }
}
