<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\MapsInput;
use App\Http\Requests\InvoiceRequest;
use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use App\Services\InvoicePaymentService;
use App\Services\InvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/**
 * Student fees. Students see/pay their own invoices; admin and accountant see all
 * (Milestone 1). Edit/delete (staff only) is limited to unpaid MANUAL invoices.
 */
class InvoiceController extends Controller
{
    use MapsInput;

    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        $query = Invoice::orderBy('id');

        if (! $user->isStaff()) {
            $query->where('student_id', $user->id);
        }

        return InvoiceResource::collection($query->get());
    }

    public function store(InvoiceRequest $request, InvoiceService $invoices): JsonResponse
    {
        $invoice = $invoices->createManual(
            $request->user(),
            [
                'description' => $request->input('description'),
                'amount' => $request->input('amount'),
                'due_date' => $request->input('dueDate'),
            ],
            $request->integer('studentId') ?: null,
        );

        return (new InvoiceResource($invoice))
            ->additional(['message' => 'Invoice created successfully.'])
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, Invoice $invoice): InvoiceResource
    {
        $this->authorizeView($request, $invoice);

        return new InvoiceResource($invoice);
    }

    public function update(InvoiceRequest $request, Invoice $invoice): JsonResponse
    {
        $updated = $this->mutableManualInvoice($invoice, function (Invoice $locked) use ($request) {
            $locked->update($this->mapInput($request, [
                'description' => 'description',
                'amount' => 'amount',
                'dueDate' => 'due_date',
            ]));

            return $locked;
        });

        return (new InvoiceResource($updated))
            ->additional(['message' => 'Invoice updated successfully.'])
            ->response();
    }

    public function destroy(Invoice $invoice): JsonResponse
    {
        $this->mutableManualInvoice($invoice, function (Invoice $locked) {
            $locked->delete();

            return $locked;
        });

        return response()->json(['message' => 'Invoice deleted successfully.']);
    }

    public function pay(Request $request, Invoice $invoice, InvoicePaymentService $payments): JsonResponse
    {
        $this->authorizeView($request, $invoice);

        [$paid, $changed] = $payments->pay($invoice);

        return (new InvoiceResource($paid))
            ->additional([
                'message' => $changed ? 'Payment recorded successfully.' : 'This invoice is already paid.',
            ])
            ->response();
    }

    private function authorizeView(Request $request, Invoice $invoice): void
    {
        $user = $request->user();

        if (! $user->isStaff() && $invoice->student_id !== $user->id) {
            throw new ApiException('You do not have permission to access this resource.', 403, 'forbidden');
        }
    }

    /**
     * Run $change on the locked invoice only if it is an unpaid manual invoice.
     * Paid or order-linked invoices are part of the financial history (409).
     */
    private function mutableManualInvoice(Invoice $invoice, callable $change): Invoice
    {
        return DB::transaction(function () use ($invoice, $change) {
            $locked = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            if (! $locked->isManual() || $locked->isPaid()) {
                throw new ApiException(
                    'Only unpaid invoices created manually can be changed or deleted.',
                    409,
                    'invoice_protected'
                );
            }

            return $change($locked);
        }, 3);
    }
}
