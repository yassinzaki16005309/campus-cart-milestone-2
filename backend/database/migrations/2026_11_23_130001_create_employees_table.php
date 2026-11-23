<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('full_name');
            $table->string('department');
            $table->decimal('base_salary', 12, 2)->default(0);
            $table->decimal('allowances', 12, 2)->default(0);
            $table->decimal('deductions', 12, 2)->default(0);
            $table->timestamps();
        });

        // Milestone 1 rules: values are >= 0 and deductions cannot exceed base + allowances.
        DB::statement(
            'ALTER TABLE employees ADD CONSTRAINT employees_amounts_non_negative
             CHECK (base_salary >= 0 AND allowances >= 0 AND deductions >= 0)'
        );
        DB::statement(
            'ALTER TABLE employees ADD CONSTRAINT employees_deductions_within_gross
             CHECK (deductions <= base_salary + allowances)'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
