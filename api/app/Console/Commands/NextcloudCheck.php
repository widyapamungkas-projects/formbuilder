<?php

namespace App\Console\Commands;

use App\Services\NextcloudStorage;
use App\Services\StorageException;
use Illuminate\Console\Command;

class NextcloudCheck extends Command
{
    protected $signature = 'app:nextcloud-check';

    protected $description = 'Check the central Nextcloud login and base folder';

    public function handle(NextcloudStorage $nextcloud): int
    {
        if (! $nextcloud->enabled()) {
            $this->error('NEXTCLOUD_URL / NEXTCLOUD_USERNAME / NEXTCLOUD_APP_PASSWORD are not all set.');

            return self::FAILURE;
        }

        try {
            $folder = $nextcloud->check($nextcloud->baseFolder());
        } catch (StorageException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info("OK: logged in, {$folder} exists and is writable.");

        return self::SUCCESS;
    }
}
