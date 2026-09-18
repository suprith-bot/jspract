// Connected Accounts Management
// Satisfies A01-E01-U05 - View Connected Social Accounts
// Satisfies A01-E01-U04 - Link Multiple Social Accounts
// Satisfies A01-E01-U06 - Disconnect Social Account

/**
 * Provider configurations
 */
const PROVIDERS = {
  google: {
    name: 'Google',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.64 13.92c-.62 1.86-2.28 3.21-4.24 3.37-1.95.16-3.87-.77-4.95-2.37-.89-1.31-1.13-2.95-.67-4.48.46-1.54 1.65-2.77 3.17-3.29 1.52-.52 3.18-.27 4.43.67-.54.54-1.09 1.07-1.67 1.57-.91-.56-2.06-.7-3.01-.21-.95.5-1.6 1.47-1.67 2.53-.1 1.61.83 3.1 2.36 3.63 1.52.53 3.26-.07 4.01-1.5h-2.67v-2.04h4.68c.09.71.05 1.44-.11 2.12z"/></svg>`
  },
  facebook: {
    name: 'Facebook',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M13.397 20.997v-8.196h2.765l.411-3.209h-3.176V7.548c0-.926.258-1.56 1.587-1.56h1.684V3.127c-.82-.088-1.643-.13-2.467-.127-2.444 0-4.122 1.492-4.122 4.231v2.355H7.332v3.209h2.753v8.202h3.312z"/></svg>`
  },
  github: {
    name: 'GitHub',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>`
  }
};

/**
 * State management
 */
let connectedAccounts = [];
let isLoading = false;

/**
 * Initialize connected accounts page
 */
async function initConnectedAccounts() {
  // Check authentication
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // Fetch and display connected accounts
  await loadConnectedAccounts();

  // Setup event listeners for connect buttons
  setupConnectButtons();
}

/**
 * Load connected accounts from API
 * Satisfies A01-E01-U05 - View Connected Social Accounts
 */
async function loadConnectedAccounts() {
  const token = localStorage.getItem('token');
  if (!token) {
    showError('Authentication required');
    return;
  }

  try {
    isLoading = true;
    showLoadingState();

    const response = await fetch('/api/auth/social/accounts', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      // Token expired, try to refresh
      const refreshed = await refreshToken();
      if (refreshed) {
        return loadConnectedAccounts();
      } else {
        window.location.href = '/login.html';
        return;
      }
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load connected accounts');
    }

    const data = await response.json();
    connectedAccounts = data.accounts || [];

    renderConnectedAccounts();
    hideLoadingState();

  } catch (error) {
    console.error('Load accounts error:', error);
    showError(error.message);
    hideLoadingState();
  } finally {
    isLoading = false;
  }
}

/**
 * Render connected accounts list
 */
function renderConnectedAccounts() {
  const container = document.getElementById('connected-accounts-list');
  if (!container) return;

  if (connectedAccounts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
        </svg>
        <p>No connected accounts yet. Link a social account to get started.</p>
      </div>
    `;
    return;
  }

  const html = connectedAccounts.map(account => {
    const provider = PROVIDERS[account.provider];
    const connectedDate = new Date(account.connectedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    return `
      <div class="account-card" data-account-id="${account.id}" data-provider="${account.provider}">
        <div class="account-info">
          <div class="account-icon">
            ${provider.icon}
          </div>
          <div class="account-details">
            <h3>${account.email || provider.name}</h3>
            <p>Connected on ${connectedDate}</p>
          </div>
        </div>
        <button 
          class="disconnect-btn" 
          data-provider="${account.provider}"
          aria-label="Disconnect ${provider.name} account"
        >
          Disconnect
        </button>
      </div>
    `;
  }).join('');

  container.innerHTML = html;

  // Attach disconnect event listeners
  const disconnectButtons = container.querySelectorAll('.disconnect-btn');
  disconnectButtons.forEach(button => {
    button.addEventListener('click', handleDisconnect);
  });
}

/**
 * Setup connect buttons for available providers
 * Satisfies A01-E01-U04 - Link Multiple Social Accounts
 */
function setupConnectButtons() {
  const availableContainer = document.getElementById('available-providers-list');
  if (!availableContainer) return;

  const connectedProviders = connectedAccounts.map(acc => acc.provider);
  const availableProviders = Object.keys(PROVIDERS).filter(
    provider => !connectedProviders.includes(provider)
  );

  if (availableProviders.length === 0) {
    availableContainer.innerHTML = `
      <p class="text-muted">All available providers are connected.</p>
    `;
    return;
  }

  const html = availableProviders.map(providerKey => {
    const provider = PROVIDERS[providerKey];
    return `
      <button 
        class="social-login-btn ${providerKey}"
        data-provider="${providerKey}"
        data-mode="link"
      >
        ${provider.icon}
        <span>Connect ${provider.name}</span>
      </button>
    `;
  }).join('');

  availableContainer.innerHTML = html;

  // Attach event listeners
  const connectButtons = availableContainer.querySelectorAll('.social-login-btn');
  connectButtons.forEach(button => {
    button.addEventListener('click', handleConnect);
  });
}

/**
 * Handle connect button click
 * Satisfies A01-E01-U04 - Link Multiple Social Accounts
 */
function handleConnect(event) {
  event.preventDefault();
  
  const button = event.currentTarget;
  const provider = button.dataset.provider;
  
  if (!provider || isLoading) return;

  button.classList.add('loading');
  button.disabled = true;

  hideError();
  hideSuccess();

  // Redirect to OAuth flow with link mode
  const redirect = encodeURIComponent(window.location.pathname);
  window.location.href = `/api/auth/social/${provider}/initiate?mode=link&redirect=${redirect}`;
}

/**
 * Handle disconnect button click
 * Satisfies A01-E01-U06 - Disconnect Social Account
 */
async function handleDisconnect(event) {
  event.preventDefault();
  
  const button = event.currentTarget;
  const provider = button.dataset.provider;
  const providerName = PROVIDERS[provider]?.name || provider;

  // Confirm disconnect
  const confirmed = confirm(
    `Are you sure you want to disconnect your ${providerName} account?\n\n` +
    `You will no longer be able to sign in using ${providerName}.`
  );

  if (!confirmed) return;

  // Check if this is the last authentication method
  if (connectedAccounts.length === 1) {
    const hasPassword = await checkHasPassword();
    if (!hasPassword) {
      alert(
        'Cannot disconnect your last authentication method.\n\n' +
        'Please set a password or link another account before disconnecting.'
      );
      return;
    }
  }

  try {
    button.disabled = true;
    button.textContent = 'Disconnecting...';

    const token = localStorage.getItem('token');
    const response = await fetch(`/api/auth/social/accounts/${provider}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      // Token expired, try to refresh
      const refreshed = await refreshToken();
      if (refreshed) {
        return handleDisconnect(event);
      } else {
        window.location.href = '/login.html';
        return;
      }
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.details || 'Failed to disconnect account');
    }

    const data = await response.json();
    
    showSuccess(`${providerName} account disconnected successfully`);
    
    // Reload accounts
    await loadConnectedAccounts();

  } catch (error) {
    console.error('Disconnect error:', error);
    showError(error.message);
    button.disabled = false;
    button.textContent = 'Disconnect';
  }
}

/**
 * Check if user has a password set
 */
async function checkHasPassword() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      return data.hasPassword || false;
    }
  } catch (error) {
    console.error('Check password error:', error);
  }
  return false;
}

/**
 * Refresh access token using refresh token
 */
async function refreshToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  try {
    const response = await fetch('/api/users/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      return false;
    }

    const data = await response.json();
    localStorage.setItem('token', data.token);
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
    return true;

  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
}

/**
 * Show success message
 */
function showSuccess(message) {
  hideError();
  let successElement = document.getElementById('success-message');
  
  if (!successElement) {
    successElement = document.createElement('div');
    successElement.id = 'success-message';
    successElement.className = 'alert-success';
    
    const container = document.querySelector('.connected-accounts-container');
    if (container) {
      container.insertBefore(successElement, container.firstChild);
    }
  }

  successElement.textContent = message;
  successElement.style.display = 'block';

  setTimeout(() => {
    hideSuccess();
  }, 5000);
}

/**
 * Hide success message
 */
function hideSuccess() {
  const successElement = document.getElementById('success-message');
  if (successElement) {
    successElement.style.display = 'none';
  }
}

/**
 * Show error message
 */
function showError(message) {
  hideSuccess();
  let errorElement = document.getElementById('error-message');
  
  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.id = 'error-message';
    errorElement.className = 'social-error-message show';
    
    const container = document.querySelector('.connected-accounts-container');
    if (container) {
      container.insertBefore(errorElement, container.firstChild);
    }
  }

  errorElement.textContent = message;
  errorElement.classList.add('show');
}

/**
 * Hide error message
 */
function hideError() {
  const errorElement = document.getElementById('error-message');
  if (errorElement) {
    errorElement.classList.remove('show');
  }
}

/**
 * Show loading state
 */
function showLoadingState() {
  const container = document.getElementById('connected-accounts-list');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="width: 40px; height: 40px; border: 3px solid var(--color-line-light); border-top-color: var(--color-accent-primary); border-radius: 50%; animation: spin 750ms infinite linear;"></div>
        <p>Loading connected accounts...</p>
      </div>
    `;
  }
}

/**
 * Hide loading state
 */
function hideLoadingState() {
  // Rendering will replace the loading state
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initConnectedAccounts);
} else {
  initConnectedAccounts();
}

// Export functions for testing
window.connectedAccounts = {
  loadConnectedAccounts,
  handleDisconnect,
  handleConnect
};
