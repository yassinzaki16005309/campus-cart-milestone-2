<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\TransactionController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| CampusCart API  (all routes are prefixed with /api)
|--------------------------------------------------------------------------
| Role matrix = the Angular route guards from Milestone 1:
|   profile, student-fees ........ admin, accountant, student
|   payroll, budget .............. admin, accountant
|   store ........................ admin, student
*/

// Public
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:20,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:20,1');

Route::middleware('auth:sanctum')->group(function () {

    // Session
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Profile (all roles): retrieve, update, delete
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::match(['put', 'patch'], '/profile', [ProfileController::class, 'update']);
    Route::delete('/profile', [ProfileController::class, 'destroy']);

    // Student fees (all roles; students are limited to their own invoices in the controller)
    Route::get('/invoices', [InvoiceController::class, 'index']);
    Route::post('/invoices', [InvoiceController::class, 'store']);
    Route::get('/invoices/{invoice}', [InvoiceController::class, 'show']);
    Route::post('/invoices/{invoice}/pay', [InvoiceController::class, 'pay']);
    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);

    // Payroll + budget: admin and accountant
    Route::middleware('role:admin,accountant')->group(function () {
        Route::get('/payroll/report', [EmployeeController::class, 'report']);
        Route::apiResource('employees', EmployeeController::class);
        Route::apiResource('transactions', TransactionController::class);
        Route::match(['put', 'patch'], '/invoices/{invoice}', [InvoiceController::class, 'update']);
        Route::delete('/invoices/{invoice}', [InvoiceController::class, 'destroy']);
    });

    // Store: admin and student
    Route::middleware('role:admin,student')->group(function () {
        Route::get('/products', [ProductController::class, 'index']);
        Route::get('/products/{product}', [ProductController::class, 'show']);
        Route::post('/checkout', [CheckoutController::class, 'store']);
    });

    // Product management: admin only (no Milestone 1 UI, API only)
    Route::middleware('role:admin')->group(function () {
        Route::post('/products', [ProductController::class, 'store']);
        Route::match(['put', 'patch'], '/products/{product}', [ProductController::class, 'update']);
        Route::delete('/products/{product}', [ProductController::class, 'destroy']);
    });
});
