import React from 'react';

export default function Login() {
  const handleLogin = () => {
    // This redirects the user's browser to your Backend OAuth route!
    window.location.href = 'http://localhost:3000/auth/github';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '15vh', fontFamily: 'sans-serif' }}>
      <h1>⚙️ CI/CD Scheduler</h1>
      <p style={{ color: '#555', marginBottom: '30px' }}>Automate your deployment pipelines beautifully.</p>
      
      <button 
        onClick={handleLogin} 
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          backgroundColor: '#24292e',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        Login with GitHub
      </button>
    </div>
  );
}
