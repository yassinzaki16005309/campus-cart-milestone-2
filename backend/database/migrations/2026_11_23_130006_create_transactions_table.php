<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->string('department', 100)->index('transactions_department_index');
            $table->enum('type', ['income', 'expense']);
            $table->decimal('amount', 12, 2);
            $table->date('date');
            $table->string('description');
            // NULL = manual budget entry. UNIQUE = at most one income record per order.
            $table->unsignedBigInteger('order_id')->nullable()->unique('transactions_order_id_unique');
            $table->timestamps();

            // Composite FK: store income must carry the order's total.
            // Rows with order_id NULL (manual entries) are not checked by MariaDB.
            $table->foreign(['order_id', 'amount'], 'transactions_order_amount_foreign')
                ->references(['id', 'total'])
                ->on('orders')
                ->restrictOnDelete();
        });

        DB::statement('ALTER TABLE transactions ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
