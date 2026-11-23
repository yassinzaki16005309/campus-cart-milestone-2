<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** Read-only: orders are created only by checkout and are never deleted. */
class OrderController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        $query = Order::with(['items.product', 'invoice', 'transaction'])->orderBy('id');

        if (! $user->isStaff()) {
            $query->where('user_id', $user->id);
        }

        return OrderResource::collection($query->get());
    }

    public function show(Request $request, Order $order): OrderResource
    {
        $user = $request->user();

        if (! $user->isStaff() && $order->user_id !== $user->id) {
            throw new ApiException('You do not have permission to access this resource.', 403, 'forbidden');
        }

        return new OrderResource($order->load(['items.product', 'invoice', 'transaction']));
    }
}
