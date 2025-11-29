import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import BalloonGame from '../components/BalloonGame';
import './Main.css';

function Main() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const handleLogout = () => {
    navigate('/');
  };

  return (
    <div className="main-container">
      <header className="main-header">
        <div className="header-left">
          <div className="logo-section">
            <div className="logo-icon">🎈</div>
            <div>
              <h1>Balloon Popper</h1>
              <p className="tagline">Pop your way to victory!</p>
            </div>
          </div>
        </div>
        <div className="header-right">
          {user && (
            <div className="user-info">
              <div className="user-avatar">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="user-details">
                <span className="user-name">{user.displayName || user.email}</span>
                <span className="user-email">{user.email}</span>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="logout-button">
            <span className="logout-icon">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </header>
      
      <main className="main-content">
        <BalloonGame />
      </main>
    </div>
  );
}

export default Main;

