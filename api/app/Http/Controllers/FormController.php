<?php

namespace App\Http\Controllers;

use App\Models\Form;
use App\Services\NextcloudStorage;
use App\Services\StorageException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class FormController extends Controller
{
    private const STATUSES = ['draft', 'published', 'archived'];

    public function index(Request $request)
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(self::STATUSES)],
        ]);

        $user = $request->user();
        $query = Form::query()->with('user:id,name');

        if (! $user->isAdmin()) {
            $query->where('user_id', $user->id);
        }
        if (! empty($data['q'])) {
            $query->where('name', 'like', '%'.addcslashes($data['q'], '\\%_').'%');
        }
        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }

        return $query->latest('updated_at')->limit(200)->get()
            ->map(fn (Form $f) => $this->present($f))
            ->values();
    }

    public function store(Request $request, NextcloudStorage $nextcloud)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:1000'],
            'storage_type' => ['nullable', Rule::in(['default', 'nextcloud'])],
        ]);

        $type = $data['storage_type'] ?? 'default';
        if ($type === 'nextcloud' && ! $nextcloud->enabled()) {
            throw ValidationException::withMessages(['storage_type' => 'Nextcloud is not configured on the server.']);
        }

        // Any failure inside (including Nextcloud) rolls the new form back.
        $form = DB::transaction(function () use ($request, $data, $type, $nextcloud) {
            $form = new Form(['name' => $data['name'], 'description' => $data['description'] ?? null]);
            $form->user_id = $request->user()->id;
            $form->status = 'draft';
            $form->storage_type = $type;
            $form->save();

            if ($type === 'nextcloud') {
                try {
                    $folder = $nextcloud->check($nextcloud->folderFor($form));
                } catch (StorageException $e) {
                    throw ValidationException::withMessages(['nextcloud' => $e->getMessage()]);
                }
                $form->storage_config = ['folder' => $folder];
                $form->save();
            }

            return $form;
        });

        return response()->json($this->present($form->load('user:id,name')), 201);
    }

    public function update(Request $request, Form $form)
    {
        $this->authorizeAccess($request, $form);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'status' => ['sometimes', Rule::in(self::STATUSES)],
        ]);

        $form->update($data);

        return response()->json($this->present($form->load('user:id,name')));
    }

    public function destroy(Request $request, Form $form)
    {
        $this->authorizeAccess($request, $form);
        $form->delete();

        return response()->noContent();
    }

    // Not the owner and not an admin: behave as if the form does not exist.
    private function authorizeAccess(Request $request, Form $form): void
    {
        $user = $request->user();
        abort_unless($user->isAdmin() || $form->user_id === $user->id, 404);
    }

    private function folderOf(Form $f): ?string
    {
        if ($f->storage_type !== 'nextcloud') {
            return null;
        }
        try {
            return $f->storage_config['folder'] ?? null;
        } catch (\Throwable) {
            return null; // e.g. APP_KEY changed: do not break the whole list
        }
    }

    private function present(Form $f): array
    {
        return [
            'id' => $f->id,
            'name' => $f->name,
            'description' => $f->description,
            'status' => $f->status,
            'storage_type' => $f->storage_type,
            'storage_folder' => $this->folderOf($f),
            'owner' => $f->user?->name,
            'updated_at' => $f->updated_at,
        ];
    }
}
