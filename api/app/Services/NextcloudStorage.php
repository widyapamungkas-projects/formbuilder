<?php

namespace App\Services;

use App\Models\Form;
use Illuminate\Support\Str;
use League\Flysystem\Filesystem;
use League\Flysystem\WebDAV\WebDAVAdapter;
use Sabre\DAV\Client;
use Throwable;

class NextcloudStorage
{
    public function enabled(): bool
    {
        return filled(config('formstorage.nextcloud_url'))
            && filled(config('formstorage.nextcloud_username'))
            && filled(config('formstorage.nextcloud_password'));
    }

    private function baseUrl(): string
    {
        if (! $this->enabled()) {
            throw new StorageException('Nextcloud is not configured on the server.');
        }
        $url = rtrim((string) config('formstorage.nextcloud_url'), '/');
        if (! str_starts_with($url, 'https://') && ! str_starts_with($url, 'http://')) {
            throw new StorageException('Nextcloud URL is invalid.');
        }

        return $url;
    }

    /** Returns "/a/b". Rejects the root, "." / ".." segments and control characters. */
    public function normalizeFolder(string $folder): string
    {
        $folder = str_replace('\\', '/', trim($folder));
        if (preg_match('/[\x00-\x1F\x7F]/', $folder)) {
            throw new StorageException('Folder path contains invalid characters.');
        }

        $parts = array_values(array_filter(explode('/', $folder), fn ($p) => $p !== ''));
        foreach ($parts as $part) {
            if ($part === '.' || $part === '..') {
                throw new StorageException('Folder path cannot contain "." or "..".');
            }
        }
        if ($parts === []) {
            throw new StorageException('Choose a subfolder, not the root.');
        }

        return '/'.implode('/', $parts);
    }

    public function baseFolder(): string
    {
        return $this->normalizeFolder((string) config('formstorage.nextcloud_base_folder') ?: '/Forms');
    }

    /** Every form gets its own folder: <base>/<slug>-<id>. The id keeps folders unique and separate. */
    public function folderFor(Form $form): string
    {
        $slug = trim(substr(Str::slug($form->name), 0, 60), '-');

        return $this->baseFolder().'/'.($slug !== '' ? $slug : 'form').'-'.$form->id;
    }

    // Defense in depth: nothing outside the configured base folder is ever touched.
    private function assertInsideBase(string $folder): string
    {
        $folder = $this->normalizeFolder($folder);
        if (! str_starts_with($folder.'/', $this->baseFolder().'/')) {
            throw new StorageException('Folder is outside the allowed base folder.');
        }

        return $folder;
    }

    private function client(string $baseUri): Client
    {
        $client = new Client([
            'baseUri' => $baseUri,
            'userName' => (string) config('formstorage.nextcloud_username'),
            'password' => (string) config('formstorage.nextcloud_password'),
            'authType' => Client::AUTH_BASIC,
        ]);
        $client->addCurlSetting(CURLOPT_CONNECTTIMEOUT, 5);
        $client->addCurlSetting(CURLOPT_TIMEOUT, 20);

        return $client;
    }

    private function userRoot(): string
    {
        return '/remote.php/dav/files/'.rawurlencode((string) config('formstorage.nextcloud_username'));
    }

    /** Flysystem disk rooted at a form's folder (used later for uploads). */
    public function disk(string $folder): Filesystem
    {
        $folder = $this->assertInsideBase($folder);
        $encoded = implode('/', array_map('rawurlencode', explode('/', ltrim($folder, '/'))));
        $baseUri = $this->baseUrl().$this->userRoot().'/'.$encoded.'/';

        return new Filesystem(new WebDAVAdapter($this->client($baseUri)));
    }

    /** Verifies the login, creates the folder chain and does a write/delete round trip. */
    public function check(string $folder): string
    {
        $folder = $this->assertInsideBase($folder);

        try {
            $client = $this->client($this->baseUrl().'/');

            $res = $client->request('PROPFIND', $this->userRoot().'/', null, ['Depth' => '0']);
            if ($res['statusCode'] === 401) {
                throw new StorageException('Nextcloud rejected the server login. Ask an admin to check the app password.');
            }
            if ($res['statusCode'] >= 400) {
                throw new StorageException('Nextcloud refused the request ('.$res['statusCode'].').');
            }

            $path = $this->userRoot();
            foreach (explode('/', ltrim($folder, '/')) as $segment) {
                $path .= '/'.rawurlencode($segment);
                $probe = $client->request('PROPFIND', $path, null, ['Depth' => '0']);
                if ($probe['statusCode'] === 404) {
                    $made = $client->request('MKCOL', $path);
                    if ($made['statusCode'] !== 201) {
                        throw new StorageException('Cannot create folder "'.$segment.'".');
                    }
                } elseif ($probe['statusCode'] >= 400) {
                    throw new StorageException('Cannot access folder "'.$segment.'".');
                }
            }
        } catch (StorageException $e) {
            throw $e;
        } catch (Throwable) {
            throw new StorageException('Cannot reach Nextcloud. Try again later.');
        }

        try {
            $disk = $this->disk($folder);
            $name = '.formbuilder-write-test-'.bin2hex(random_bytes(4)).'.tmp';
            $disk->write($name, 'ok');
            $disk->delete($name);
        } catch (Throwable) {
            throw new StorageException('Cannot write to the Nextcloud folder.');
        }

        return $folder;
    }
}
