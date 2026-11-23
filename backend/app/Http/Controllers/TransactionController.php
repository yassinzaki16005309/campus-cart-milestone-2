<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\MapsInput;
use App\Http\Requests\TransactionRequest;
use App\Http\Resources\TransactionResource;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Department budget transactions (admin + accountant).
 * Rows with an order_id (store income) are read-only: update/delete answer 409.
 */
class TransactionController extends Controller
{
    use MapsInput;

    private const MAP = [
        'department' => 'department',
        'type' => 'type',
        'amount' => 'amount',
        'date' => 'date',
        'description' => 'description',
    ];

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Transaction::orderBy('id');

        if ($request->filled('department')) {
            $query->where('department', $request->query('department'));
        }

        return TransactionResource::collection($query->get());
    }

    public function store(TransactionRequest $request): JsonResponse
    {
        // order_id is not mass-assignable and never read from the request.
        $transaction = Transaction::create($this->mapInput($request, self::MAP));

        return (new TransactionResource($transaction))
            ->additional(['message' => 'Transaction added successfully.'])
            ->response()
            ->setStatusCode(201);
    }

    public function show(Transaction $transaction): TransactionResource
    {
        return new TransactionResource($transaction);
    }

    public function update(TransactionRequest $request, Transaction $transaction): JsonResponse
    {
        $transaction->update($this->mapInput($request, self::MAP));

        return (new TransactionResource($transaction))
            ->additional(['message' => 'Transaction updated successfully.'])
            ->response();
    }

    public function destroy(Transaction $transaction): JsonResponse
    {
        if ($transaction->isOrderLinked()) {
            throw new ApiException(Transaction::PROTECTED_MESSAGE, 409, 'transaction_protected');
        }

        $transaction->delete();

        return response()->json(['message' => 'Transaction deleted successfully.']);
    }
}
