// Social Login Frontend Logic

/**
 * Error messages for different OAuth error codes
 * Satisfies A01-E01-U07 - Handle Social Authentication Errors
 */
const ERROR_MESSAGES = {
  auth_denied: 'You cancelled the sign-in process. Please try again.',
  auth_failed: 'Authentication failed. Please try again.',
  invalid_state: 'Authentication session expired. Please try again.',
  account_exists: 'This account is already linked to another profile. Please use a different account.',
  provider_error: 'Service temporarily unavailable. Please try again later.',
  timeout: 'Connection timed out. Please check your internet connection and try again.',
  network_error: 'Network connectivity issue. Please check your connection and retry.',
  profile_incomplete: 'Unable to retrieve required profile information. Please try again.',
  default: 'An error occurred during authentication. Please try again.'
};

/**
 * Provider display names
 */
const PROVIDER_NAMES = {
  google: 'Google',
  facebook: 'Facebook',
  github: 'GitHub'
};

/**
 * Initialize social login functionality
 */
function initSocialLogin() {
  // Check for OAuth callback parameters on page load
  checkOAuthCallback();

  // Attach event listeners to social login buttons
  const socialButtons = document.querySelectorAll('.social-login-btn');
  socialButtons.forEach(button => {
    button.addEventListener('click', handleSocialLogin);
  });
}

/**
 * Handle social login button click
 * Satisfies A01-E01-U01, A01-E01-U02, A01-E01-U03 - OAuth initiation
 */
function handleSocialLogin(event) {
  event.preventDefault();
  
  const button = event.currentTarget;
  const provider = button.dataset.provider;
  
  if (!provider) {
    console.error('No provider specified');
    return;
  }

  // Set loading state
  button.classList.add('loading');
  button.disabled = true;

  // Clear any existing error messages
  hideErrorMessage();

  // Redirect to OAuth initiation endpoint
  const mode = button.dataset.mode || 'login'; // 'login' or 'link'
  const redirect = encodeURIComponent(window.location.pathname || '/');
  
  window.location.href = `/api/auth/social/${provider}/initiate?mode=${mode}&redirect=${redirect}`;
}

/**
 * Check for OAuth callback parameters in URL
 * Satisfies A01-E01-U01, A01-E01-U02, A01-E01-U03 - OAuth callback handling
 */
function checkOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  
  // Check for successful authentication
  const token = urlParams.get('token');
  const refreshToken = urlParams.get('refresh_token');
  const avatarUrl = urlParams.get('avatar_url');
  const displayName = urlParams.get('display_name');
  
  if (token) {
    // Store tokens
    localStorage.setItem('token', token);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    
    // Store user profile data
    if (avatarUrl) {
      localStorage.setItem('avatarUrl', decodeURIComponent(avatarUrl));
    }
    if (displayName) {
      localStorage.setItem('displayName', decodeURIComponent(displayName));
    }

    // Clean URL
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    // Redirect to main app
    window.location.href = '/';
    return;
  }

  // Check for errors
  const error = urlParams.get('error');
  const message = urlParams.get('message');
  
  if (error) {
    const errorMessage = message ? decodeURIComponent(message) : (ERROR_MESSAGES[error] || ERROR_MESSAGES.default);
    showErrorMessage(errorMessage);
    
    // Clean URL
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }
}

/**
 * Display error message to user
 * Satisfies A01-E01-U07 - Handle Social Authentication Errors
 */
function showErrorMessage(message) {
  let errorElement = document.getElementById('social-error-message');
  
  if (!errorElement) {
    // Create error element if it doesn't exist
    errorElement = document.createElement('div');
    errorElement.id = 'social-error-message';
    errorElement.className = 'social-error-message';
    
    const container = document.querySelector('.social-login-container');
    if (container) {
      container.insertBefore(errorElement, container.firstChild);
    }
  }

  errorElement.textContent = message;
  errorElement.classList.add('show');

  // Auto-hide after 10 seconds
  setTimeout(() => {
    hideErrorMessage();
  }, 10000);
}

/**
 * Hide error message
 */
function hideErrorMessage() {
  const errorElement = document.getElementById('social-error-message');
  if (errorElement) {
    errorElement.classList.remove('show');
  }
}

/**
 * Get user profile from tokens
 * Returns display name and avatar URL from localStorage
 */
function getUserProfile() {
  return {
    displayName: localStorage.getItem('displayName') || null,
    avatarUrl: localStorage.getItem('avatarUrl') || null
  };
}

/**
 * Update UI with user avatar and display name
 * Satisfies A01-E01-U08 - Auto-create User Profile from Social Data
 */
function updateUserProfile() {
  const profile = getUserProfile();
  
  // Update avatar in header if element exists
  const avatarElement = document.getElementById('user-avatar');
  if (avatarElement && profile.avatarUrl) {
    avatarElement.src = profile.avatarUrl;
    avatarElement.alt = profile.displayName || 'User profile';
  }

  // Update display name if element exists
  const nameElement = document.getElementById('user-display-name');
  if (nameElement && profile.displayName) {
    nameElement.textContent = profile.displayName;
  }
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  const token = localStorage.getItem('token');
  const refreshToken = localStorage.getItem('refreshToken');
  return !!(token || refreshToken);
}

/**
 * Redirect to login if not authenticated
 */
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/login.html';
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSocialLogin);
} else {
  initSocialLogin();
}

// Export functions for use in other modules
window.socialAuth = {
  handleSocialLogin,
  showErrorMessage,
  hideErrorMessage,
  getUserProfile,
  updateUserProfile,
  isAuthenticated,
  requireAuth
};
