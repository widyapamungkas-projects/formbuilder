<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    private const FIELDS = ['id', 'name', 'email', 'role', 'is_active', 'created_at'];

    public function index()
    {
        return User::orderBy('name')->get(self::FIELDS);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'string', 'min:10'],
            'role' => ['required', Rule::in(['admin', 'user'])],
        ]);

        $user = User::create($data + ['is_active' => true]);

        return response()->json($user->only(self::FIELDS), 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'email' => ['sometimes', 'email', 'max:190', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'nullable', 'string', 'min:10'],
            'role' => ['sometimes', Rule::in(['admin', 'user'])],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $isSelf = $user->is($request->user());
        if ($isSelf && ((isset($data['role']) && $data['role'] !== 'admin')
            || (isset($data['is_active']) && ! $data['is_active']))) {
            abort(422, 'You cannot demote or deactivate your own account.');
        }

        if (empty($data['password'])) {
            unset($data['password']);
        }

        $user->update($data);

        // A deactivated user loses any open session immediately.
        if (isset($data['is_active']) && ! $data['is_active']) {
            DB::table('sessions')->where('user_id', $user->id)->delete();
        }

        return response()->json($user->fresh()->only(self::FIELDS));
    }

    public function destroy(Request $request, User $user)
    {
        if ($user->is($request->user())) {
            abort(422, 'You cannot delete your own account.');
        }

        $user->delete();

        return response()->noContent();
    }
}
