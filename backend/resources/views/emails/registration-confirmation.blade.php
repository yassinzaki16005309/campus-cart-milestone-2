<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Welcome to CampusCart</title>
</head>
<body style="margin:0;padding:24px;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
    <div style="max-width:560px;margin:0 auto;padding:30px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:10px;">

        <h1 style="margin-top:0;color:#2563eb;">Welcome to CampusCart</h1>

        <p>Hello {{ $name }},</p>

        <p>Your CampusCart account has been created successfully. You can now log in with your username.</p>

        <p>
            <strong>Username:</strong> {{ $username }}<br>
            <strong>Account type:</strong> student
        </p>

        <p><strong>Your interests:</strong></p>
        @if (count($interests) > 0)
            <ul>
                @foreach ($interests as $interest)
                    <li>{{ $interest }}</li>
                @endforeach
            </ul>
        @else
            <p>You have not selected any interests yet. You can add them any time on your profile page.</p>
        @endif

        <p>
            <a href="{{ $loginUrl }}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">
                Log in to CampusCart
            </a>
        </p>

        <p style="color:#64748b;font-size:14px;">
            If you did not create this account, you can ignore this email. We never send your password by email.
        </p>

    </div>
</body>
</html>
