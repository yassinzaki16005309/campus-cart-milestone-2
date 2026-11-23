<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the Milestone 1 demo data. Every seeder is idempotent and never
     * overwrites existing rows, so this is safe to run repeatedly.
     */
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            EmployeeSeeder::class,
            ProductSeeder::class,
        ]);
    }
}
