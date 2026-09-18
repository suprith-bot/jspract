# Social Authentication Setup Guide

This guide explains how to configure OAuth providers (Google, Facebook, GitHub) for the CheckIt Task Manager application.

## Prerequisites

- Node.js (latest LTS version)
- Docker (for the local PostgreSQL database)
- Developer accounts with Google, Facebook, and GitHub

## Step 1: Start the Local Database

The app uses a local PostgreSQL database running in Docker. Start it with:

```bash
npm run db:up
```

On first start, the container automatically creates the full schema (including the
social-auth tables) from `db/init/001_schema.sql`, so no manual migration is needed
for a fresh database.

To (re)apply the incremental migration manually against the running container:

```bash
npm run migrate 001_add_social_auth_tables.sql

# OR using psql directly inside the container
docker exec -i checkit-postgres psql -U checkit -d checkit -f - < migrations/001_add_social_auth_tables.sql
```

## Step 2: Configure OAuth Providers

### Google OAuth 2.0

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Navigate to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure consent screen (add app name, logo, scopes: email, profile)
6. Select **Web application** as application type
7. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/social/google/callback`
   - Production: `https://yourdomain.com/api/auth/social/google/callback`
8. Copy **Client ID** and **Client Secret**

### Facebook Login

1. Go to [Facebook for Developers](https://developers.facebook.com/)
2. Create a new app or select existing one
3. Add **Facebook Login** product
4. Configure OAuth redirect URIs in **Settings** → **Basic**:
   - Development: `http://localhost:3000/api/auth/social/facebook/callback`
   - Production: `https://yourdomain.com/api/auth/social/facebook/callback`
5. In **Facebook Login Settings**, add valid OAuth redirect URIs (same as above)
6. Set **Use Strict Mode for Redirect URIs** to **Yes**
7. Copy **App ID** and **App Secret**

### GitHub OAuth Apps

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in application details:
   - **Application name**: CheckIt Task Manager
   - **Homepage URL**: `http://localhost:3000` (or your domain)
   - **Authorization callback URL**: `http://localhost:3000/api/auth/social/github/callback`
4. Click **Register application**
5. Copy **Client ID**
6. Generate and copy **Client Secret**

## Step 3: Environment Configuration

Copy `.env.example` to `.env` and fill in your OAuth credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# JWT Configuration (REQUIRED)
JWT_SECRET=generate_a_strong_random_secret_here
REFRESH_TOKEN_SECRET=generate_another_strong_random_secret_here
REFRESH_TOKEN_EXPIRY=30d

# Database (local PostgreSQL in Docker)
DATABASE_URL=postgresql://checkit:checkit@localhost:5432/checkit

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/social/google/callback

# Facebook OAuth
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_REDIRECT_URI=http://localhost:3000/api/auth/social/facebook/callback

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/social/github/callback

# OAuth Security (REQUIRED)
OAUTH_STATE_SECRET=generate_a_random_secret_for_csrf_protection

# Frontend
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Generating Secure Secrets

Use Node.js crypto to generate secure secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run this command three times to generate:
- JWT_SECRET
- REFRESH_TOKEN_SECRET
- OAUTH_STATE_SECRET

## Step 4: Install Dependencies

```bash
cd jspract
npm install
```

New dependencies for social authentication:
- `passport` (^0.7.0)
- `passport-google-oauth20` (^2.0.0)
- `passport-facebook` (^3.0.0)
- `passport-github2` (^0.1.12)
- `express-session` (^1.19.0)
- `axios` (^1.20.0)
- `uuid` (^14.0.2)

## Step 5: Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

## Step 6: Test Social Authentication

### Testing OAuth Flows

1. **Google Login:**
   - Navigate to `http://localhost:3000/login`
   - Click "Sign in with Google"
   - Authorize the application
   - You should be redirected back with JWT token

2. **Facebook Login:**
   - Click "Sign in with Facebook"
   - Authorize the application
   - You should be redirected back with JWT token

3. **GitHub Login:**
   - Click "Sign in with GitHub"
   - Authorize the application
   - You should be redirected back with JWT token

### Testing Account Linking

1. Sign in with email/password or one social provider
2. Navigate to Connected Accounts page
3. Click "Link Google Account" (or Facebook/GitHub)
4. Complete OAuth flow
5. Account should now show as connected

### Testing Account Disconnection

1. Go to Connected Accounts page
2. Click "Disconnect" on a social account
3. Confirm disconnection
4. Account should be removed from list

## API Endpoints

### OAuth Initiation
```
GET /api/auth/social/{provider}/initiate
Query params:
  - mode: 'login' (default) or 'link'
  - redirect: post-auth redirect URL
```

### OAuth Callback
```
GET /api/auth/social/{provider}/callback
Query params:
  - code: authorization code
  - state: CSRF token
```

### Get Connected Accounts
```
GET /api/auth/social/accounts
Headers: Authorization: Bearer <token>
```

### Disconnect Account
```
DELETE /api/auth/social/accounts/{provider}
Headers: Authorization: Bearer <token>
```

### Refresh Token
```
POST /api/users/refresh
Body: { "refreshToken": "..." }
```

### Logout
```
POST /api/users/logout
Headers: Authorization: Bearer <token>
Body: { "revokeAllSessions": false }
```

## Security Considerations

### Production Checklist

- [ ] Use HTTPS for all OAuth redirect URIs
- [ ] Set strong JWT_SECRET and REFRESH_TOKEN_SECRET (64+ characters)
- [ ] Configure ALLOWED_ORIGINS to only include your production domains
- [ ] Enable CORS restrictions (modify app.js corsOptions)
- [ ] Set up token blacklist using Redis for immediate JWT revocation
- [ ] Enable rate limiting on OAuth endpoints
- [ ] Monitor OAuth error rates for suspicious activity
- [ ] Set up automated cleanup of expired oauth_states table
- [ ] Review and approve OAuth consent screens for each provider
- [ ] Use environment-specific OAuth apps (dev vs. production)

### Important Security Notes

1. **Never commit `.env` file** - it contains secrets
2. **JWT cannot be revoked** - tokens are valid until expiry (1 hour)
3. **Refresh tokens are rotated** - old refresh token is invalidated when new one is issued
4. **State tokens expire** - CSRF protection tokens expire after 10 minutes
5. **Password nullable** - users with social-only accounts have NULL password

## Troubleshooting

### "Invalid OAuth redirect URI"
- Ensure redirect URI in OAuth provider settings **exactly matches** the URI in .env
- Check for trailing slashes (should not have one)
- Verify http vs https

### "Missing required parameter: state"
- Clear browser cache and cookies
- Check OAUTH_STATE_SECRET is set in .env
- Verify oauth_states table exists in database

### "Profile incomplete" error
- Some providers may not return email if user hasn't verified it
- GitHub requires public email or verified email in account settings
- Check OAuth scopes include 'email'

### "Account already linked to another profile"
- Social account (e.g., Google ID) is already connected to a different user
- User must disconnect from other account first
- Or use a different email address

### Token refresh fails
- Refresh token may have expired (30 days default)
- User may have been deleted from database
- Verify REFRESH_TOKEN_SECRET matches what was used to sign the token

## Database Schema

### users table additions
- `avatar_url` - Profile picture URL from social provider
- `display_name` - Display name from social provider
- `account_source` - Original signup method (email/google/facebook/github)
- `refresh_token_hash` - Hashed refresh token for session persistence
- `refresh_token_expiry` - Refresh token expiration timestamp

### social_providers table
- Links users to their OAuth provider accounts
- Stores encrypted access/refresh tokens
- Tracks last usage for security monitoring

### oauth_states table
- Temporary CSRF protection tokens
- Expire after 10 minutes
- Should be cleaned up regularly

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review console logs for error details
3. Verify all environment variables are set correctly
4. Ensure database migration was run successfully
5. Test OAuth flows in provider's developer console first
