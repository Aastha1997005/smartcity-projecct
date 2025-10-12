document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('loginError');
  errorDiv.style.display = 'none';

  try {
  const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      // Redirect to dashboard or profile page
      window.location.href = 'profile.html';
    } else {
      errorDiv.textContent = data.error || 'Login failed';
      errorDiv.style.display = 'block';
    }
  } catch (err) {
    errorDiv.textContent = 'Network error';
    errorDiv.style.display = 'block';
  }
});
