<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            // Users are soft-deleted, so history is preserved; RESTRICT is only a safety net.
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->decimal('total', 12, 2);
            $table->enum('payment_option', ['pay_now', 'add_to_invoice']);
            $table->timestamps();

            // Referenced by the composite foreign keys on invoices and transactions,
            // so an invoice/transaction can never disagree with its order's owner or total.
            $table->unique(['id', 'user_id', 'total'], 'orders_id_user_total_unique');
            $table->unique(['id', 'total'], 'orders_id_total_unique');
        });

        DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_total_positive CHECK (total > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
