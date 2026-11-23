<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->restrictOnDelete();
            // NULL = manual invoice. One invoice per order at most.
            $table->unsignedBigInteger('order_id')->nullable()->unique('invoices_order_id_unique');
            $table->string('description');
            $table->decimal('amount', 12, 2);
            $table->enum('status', ['paid', 'unpaid'])->default('unpaid');
            $table->date('issue_date');
            $table->date('due_date');
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index(['student_id', 'status'], 'invoices_student_status_index');

            // Composite FK: an order-linked invoice must carry the order's owner and total.
            // Rows with order_id NULL (manual invoices) are not checked by MariaDB.
            $table->foreign(['order_id', 'student_id', 'amount'], 'invoices_order_owner_amount_foreign')
                ->references(['id', 'user_id', 'total'])
                ->on('orders')
                ->restrictOnDelete();
        });

        DB::statement('ALTER TABLE invoices ADD CONSTRAINT invoices_amount_positive CHECK (amount > 0)');
        DB::statement(
            "ALTER TABLE invoices ADD CONSTRAINT invoices_paid_at_matches_status
             CHECK ((status = 'paid' AND paid_at IS NOT NULL) OR (status = 'unpaid' AND paid_at IS NULL))"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
