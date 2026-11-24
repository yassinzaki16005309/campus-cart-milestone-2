Welcome to CampusCart

Hello {{ $name }},

Your CampusCart account has been created successfully. You can now log in with your username.

Username: {{ $username }}
Account type: student

Your interests:
@if (count($interests) > 0)
@foreach ($interests as $interest)
- {{ $interest }}
@endforeach
@else
You have not selected any interests yet. You can add them any time on your profile page.
@endif

Log in: {{ $loginUrl }}

If you did not create this account, you can ignore this email. We never send your password by email.
