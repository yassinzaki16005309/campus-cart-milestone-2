<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * The three Milestone 1 demo accounts.
 *
 * Safe to run repeatedly: a demo user is created ONLY if neither its username nor
 * its email exists (soft-deleted rows included). Existing users are never updated,
 * so changed passwords, roles or profiles are never overwritten.
 */
class UserSeeder extends Seeder
{
    public function run(): void
    {
        $accounts = [
            ['admin', 'Admin123', 'CampusCart Admin', 'admin@campuscart.com', 'admin'],
            ['accountant', 'Account123', 'CampusCart Accountant', 'accountant@campuscart.com', 'accountant'],
            ['student', 'Student123', 'CampusCart Student', 'student@campuscart.com', 'student'],
        ];

        foreach ($accounts as [$username, $password, $name, $email, $role]) {
            $exists = User::withTrashed()
                ->where('username', $username)
                ->orWhere('email', $email)
                ->exists();

            if ($exists) {
                $this->command?->warn("Demo user '{$username}' already exists - left untouched.");

                continue;
            }

            User::forceCreate([
                'name' => $name,
                'username' => $username,
                'email' => $email,
                'password' => $password, // hashed by the model cast
                'role' => $role,
                'preferences' => [],
            ]);
        }
    }
}
