<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Profile deletion = soft delete + anonymization. Orders and invoices are kept
 * (their foreign keys still point at the same user row).
 *
 * Refused (409) while the user still has unpaid invoices. The check runs after
 * locking the user row, and the invoice read is a locking read, so a concurrent
 * checkout/invoice creation cannot slip an unpaid invoice past the check.
 */
class UserDeletionService
{
    public function delete(User $user): void
    {
        DB::transaction(function () use ($user) {
            $locked = User::whereKey($user->id)->lockForUpdate()->first();

            if (! $locked) {
                return; // already deleted
            }

            $unpaid = Invoice::where('student_id', $locked->id)
                ->where('status', Invoice::UNPAID)
                ->select('id')
                ->lockForUpdate()
                ->first();

            if ($unpaid) {
                throw new ApiException(
                    'You still have unpaid invoices. Please pay them before deleting your account.',
                    409,
                    'unpaid_invoices'
                );
            }

            // Anonymize: frees the username/email, removes personal data, blocks login.
            $locked->name = 'Deleted user';
            $locked->username = "deleted_{$locked->id}";
            $locked->email = "deleted_{$locked->id}@deleted.invalid";
            $locked->password = Str::random(64); // hashed by the model cast
            $locked->picture_url = null;
            $locked->preferences = null;
            $locked->credit_card_last4 = null;
            $locked->remember_token = null;
            $locked->save();

            // Revoke every way of staying logged in.
            $locked->tokens()->delete();
            DB::table('sessions')->where('user_id', $locked->id)->delete();

            $locked->delete(); // soft delete
        }, 3);
    }
}
