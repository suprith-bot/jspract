// /public/js/login.js
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
  
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
  
    try {
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
  
      const data = await response.json();
  
      if (response.ok) {
        // Store access token
        localStorage.setItem('token', data.token);
        
        // Store refresh token if provided
        // Satisfies A01-E01-U09 - Persist Login State Across Sessions
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        
        // Store user profile data if available
        if (data.avatarUrl) {
          localStorage.setItem('avatarUrl', data.avatarUrl);
        }
        if (data.displayName) {
          localStorage.setItem('displayName', data.displayName);
        }
        
        alert('Login successful!');
        window.location.href = '/'; // Redirect to tasks page
      } else {
        alert(data.error || 'Login failed.');
      }
    } catch (error) {
      console.error('Login Error:', error);
      alert('An error occurred during login.');
    }
  });
