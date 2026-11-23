<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;

/**
 * A business-rule failure that is reported to the client as a JSON message
 * (409 conflict, 403 forbidden, 422 rule violation, ...). Not logged.
 */
class ApiException extends Exception
{
    public function __construct(
        string $message,
        private readonly int $status = 422,
        private readonly ?string $errorCode = null,
    ) {
        parent::__construct($message);
    }

    public function render(): JsonResponse
    {
        return response()->json(
            array_filter([
                'message' => $this->getMessage(),
                'code' => $this->errorCode,
            ]),
            $this->status
        );
    }

    /** Expected client errors are not logged. */
    public function report(): void
    {
        //
    }
}
