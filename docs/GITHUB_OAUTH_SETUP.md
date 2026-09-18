# GitHub OAuth Configuration Guide

## Issue: Resource not accessible by integration

The error "Resource not accessible by integration" occurs when GitHub denies access to the `/user/emails` endpoint, which requires the `user:email` scope.

## Solution

The application now implements a **graceful fallback strategy**:

1. First, attempts to fetch the public email from the user's profile (`/user` endpoint)
2. If no public email is found, attempts to fetch from `/user/emails` endpoint
3. If the `/user/emails` endpoint returns 403 (permission denied), the app continues with the public email
4. If no email is available at all, returns a clear error message to the user

## Setup Instructions

### Option 1: Make Your GitHub Email Public (Easiest)

1. Go to https://github.com/settings/emails
2. Uncheck "Keep my email addresses private"
3. Select your primary email and ensure it's set as public
4. Try logging in again - the app will now use your public email

### Option 2: Grant user:email Permission

1. In your GitHub OAuth App settings, ensure `user:email` is in the requested scopes
2. When users authorize, they must grant the `user:email` permission
3. The app will be able to fetch private emails

### Option 3: Use GitHub App Instead of OAuth App

GitHub Apps have more granular permissions and better integration:
1. Convert to a GitHub App in your GitHub settings
2. Request "Email addresses" permission (read-only)
3. Users will see clearer permission requests

## Current Implementation

### Scopes Requested
```javascript
scopes: ['read:user', 'user:email']
```

- `read:user`: Read basic profile information (ALWAYS granted)
- `user:email`: Read email addresses (MAY BE denied)

### Email Fetching Strategy

```javascript
// 1. Try public email from profile
let email = profileResponse.data.email;

// 2. If not available, try emails endpoint (requires user:email scope)
if (!email) {
  try {
    const emailsResponse = await axios.get('/user/emails');
    email = emailsResponse.data.find(e => e.primary && e.verified)?.email;
  } catch (emailError) {
    // Permission denied - continue without email from this endpoint
    console.warn('GitHub emails fetch failed - user needs to make email public');
  }
}

// 3. If still no email, return clear error
if (!email) {
  throw new Error('GitHub account has no accessible email address. Please make your primary email public or grant user:email permission.');
}
```

## Error Messages

### User-Facing Error
```
GitHub account has no accessible email. Please make your primary email public in GitHub settings, or grant the user:email permission when authorizing.
```

### Technical Log
```
GitHub emails fetch failed (continuing with public email): {
  message: 'Resource not accessible by integration',
  status: '403'
}
```

## Testing

### Test Case 1: Public Email
1. Make GitHub email public
2. Attempt OAuth login
3. Should succeed using public email

### Test Case 2: Private Email with Permission
1. Keep email private
2. Grant `user:email` permission during OAuth
3. Should succeed using private email from `/user/emails`

### Test Case 3: Private Email without Permission
1. Keep email private
2. Deny `user:email` permission during OAuth
3. Should show clear error message asking user to make email public

## Troubleshooting

### Still Getting 403 Errors?

1. **Check your GitHub OAuth App configuration**:
   - Go to https://github.com/settings/developers
   - Select your OAuth App
   - Ensure the callback URL matches exactly: `http://localhost:3000/api/auth/social/github/callback`
   - Verify client ID and secret are correct in `.env`

2. **Revoke and Re-authorize**:
   - Go to https://github.com/settings/applications
   - Find your app under "Authorized OAuth Apps"
   - Click "Revoke" to reset permissions
   - Try authorizing again

3. **Check User Email Settings**:
   - User must have at least one verified email
   - If email is private, user must grant `user:email` permission
   - OR make primary email public

### User Reports "No Email Available"?

Guide them to:
1. Go to https://github.com/settings/emails
2. Verify they have at least one email address
3. Ensure it's verified (check for verification email)
4. Either make it public OR re-authorize the app with `user:email` permission

## Security Considerations

- The app never stores GitHub access tokens permanently
- Tokens are only used during the OAuth callback flow
- Email addresses are stored but never exposed to other users
- All OAuth state tokens are one-time use and expire after 10 minutes

## References

- [GitHub OAuth Scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- [GitHub REST API - List Emails](https://docs.github.com/en/rest/users/emails#list-email-addresses-for-the-authenticated-user)
- [GitHub Privacy Settings](https://github.com/settings/emails)
