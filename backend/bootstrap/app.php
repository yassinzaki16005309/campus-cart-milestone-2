<?php

use App\Http\Middleware\EnsureUserHasRole;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sanctum cookie-based SPA authentication (session + CSRF for the Angular app).
        $middleware->statefulApi();

        // The remembered-username cookie must stay readable by the Angular login form.
        $middleware->encryptCookies(except: ['campusCartRememberedUsername']);

        $middleware->alias([
            'role' => EnsureUserHasRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Friendly JSON feedback for missing pages/records.
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $message = $e->getPrevious() instanceof ModelNotFoundException
                ? 'The requested record was not found.'
                : 'Page not found.';

            return response()->json(['message' => $message], 404);
        });

        $exceptions->render(function (MethodNotAllowedHttpException $e, Request $request) {
            return $request->is('api/*')
                ? response()->json(['message' => 'This request method is not allowed.'], 405)
                : null;
        });

        // 419 = CSRF token mismatch. The CSRF check runs before authentication, so after the
        // server session expires every write ends here instead of in a 401. The Angular
        // interceptor recovers (refresh token, check /api/me, retry once or log out); this
        // gives every other client a clear message and a stable code.
        $exceptions->render(function (HttpException $e, Request $request) {
            if ($e->getStatusCode() !== 419 || ! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'message' => 'Your request could not be verified. Please reload the page and try again.',
                'code' => 'csrf_token_mismatch',
            ], 419);
        });
    })->create();
