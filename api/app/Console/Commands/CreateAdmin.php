<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class CreateAdmin extends Command
{
    protected $signature = 'app:create-admin {email} {name=Admin}';

    protected $description = 'Create an admin user (the password is asked interactively)';

    public function handle(): int
    {
        $email = $this->argument('email');

        if (User::where('email', $email)->exists()) {
            $this->error('A user with that email already exists.');

            return self::FAILURE;
        }

        $password = (string) $this->secret('Password (min 10 characters)');
        if (strlen($password) < 10) {
            $this->error('Password is too short.');

            return self::FAILURE;
        }

        User::create([
            'name' => $this->argument('name'),
            'email' => $email,
            'password' => $password,
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->info("Admin {$email} created.");

        return self::SUCCESS;
    }
}
