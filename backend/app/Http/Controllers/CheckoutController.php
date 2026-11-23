<?php

namespace App\Http\Controllers;

use App\Http\Requests\CheckoutRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\CheckoutService;
use Illuminate\Http\JsonResponse;

class CheckoutController extends Controller
{
    public function store(CheckoutRequest $request, CheckoutService $checkout): JsonResponse
    {
        $items = array_map(
            fn (array $item) => [
                'product_id' => (int) $item['productId'],
                'quantity' => (int) $item['quantity'],
            ],
            $request->input('items')
        );

        // Angular uses 'pay-now' / 'add-to-invoice'; the database enum uses underscores.
        $option = str_replace('-', '_', $request->input('paymentOption'));

        $order = $checkout->checkout($request->user(), $items, $option);

        $message = $option === Order::PAY_NOW
            ? 'Payment successful! Your purchase total is EGP '.rtrim(rtrim($order->total, '0'), '.').'.'
            : 'Your purchase has been added to your student fees as an unpaid invoice.';

        return (new OrderResource($order))
            ->additional(['message' => $message])
            ->response()
            ->setStatusCode(201);
    }
}
