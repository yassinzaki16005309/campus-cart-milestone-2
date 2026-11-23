<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Extend the default users table with the CampusCart (Milestone 1) fields.
     */
    public function up(): void
    {
        // A NOT NULL unique "username" cannot be added to existing rows safely.
        // The table was verified empty; refuse to continue if that changes.
        if (DB::table('users')->exists()) {
            throw new RuntimeException(
                'users table is not empty: add username as nullable, backfill it, then make it unique.'
            );
        }

        Schema::table('users', function (Blueprint $table) {
            // utf8mb4_bin keeps the Milestone 1 case-sensitive username matching.
            $table->string('username', 50)->collation('utf8mb4_bin')->unique()->after('name');
            $table->enum('role', ['admin', 'accountant', 'student'])->default('student')->index()->after('password');
            $table->string('picture_url', 2048)->nullable()->after('role');
            $table->json('preferences')->nullable()->after('picture_url');
            $table->char('credit_card_last4', 4)->nullable()->after('preferences');
            $table->softDeletes();
        });

        DB::statement(
            "ALTER TABLE users ADD CONSTRAINT users_credit_card_last4_check
             CHECK (credit_card_last4 IS NULL OR credit_card_last4 REGEXP '^[0-9]{4}$')"
        );
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE users DROP CONSTRAINT users_credit_card_last4_check');

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['username']);
            $table->dropIndex(['role']);
            $table->dropSoftDeletes();
            $table->dropColumn(['username', 'role', 'picture_url', 'preferences', 'credit_card_last4']);
        });
    }
};
