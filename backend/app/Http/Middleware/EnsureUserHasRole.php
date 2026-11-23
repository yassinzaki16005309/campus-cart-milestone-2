<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Server-side counterpart of the Angular roleGuard.
 * Usage: ->middleware('role:admin,accountant')
 */
class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            throw new ApiException('Unauthenticated.', 401);
        }

        if (! in_array($user->role, $roles, true)) {
            throw new ApiException('You do not have permission to access this resource.', 403, 'forbidden');
        }

        return $next($request);
    }
}
