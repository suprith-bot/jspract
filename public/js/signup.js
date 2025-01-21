// /public/js/signup.js
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
  
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
  
    try {
      const response = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
  
      const data = await response.json();
  
      if (response.ok) {
        alert('Signup successful! Please login.');
        window.location.href = '/login';
      } else {
        alert(data.error || 'Signup failed.');
      }
    } catch (error) {
      console.error('Signup Error:', error);
      alert('An error occurred during signup.');
    }
  });
  