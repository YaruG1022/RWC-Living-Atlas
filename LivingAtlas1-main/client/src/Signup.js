import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from './api.js'; // Import your API module
import InfoPage from './InfoPage';
import './AccountPage.css';
import './Signup.css';

function Signup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sponsorMessage, setSponsorMessage] = useState('');
  const [desiredAccessLevel, setDesiredAccessLevel] = useState('regular');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    // Check if all fields are filled
    if (!username || !email || !password || !sponsorMessage) {
      setMessage('Please fill in all fields.');
      return;
    }
  
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('sponsor_message', sponsorMessage);
      formData.append('desired_access_level', desiredAccessLevel);
  
      const response = await api.post('/uploadSignup', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
  
      console.log(response.data); // Log the response from the server
  
      // Send the signup notification email to the admin
      await api.post('/sendSignupNotification', {
        username: username,
        email: email,
        desired_access_level: desiredAccessLevel
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
  
      // Clear form fields after successful submission
      setUsername('');
      setEmail('');
      setPassword('');
      setSponsorMessage('');
      setDesiredAccessLevel('regular');
      setMessage('Your request is awaiting approval from an admin.');
    } catch (error) {
      console.error('Error submitting signup data:', error);
      setMessage('An error occurred while submitting your request.');
    }
  };
  

  return (
    <InfoPage title="Request Access" className="signup-page account-page">
      <div className="signup-card account-panel">
        <p className="signup-subtitle">Request access to the Living Atlas platform</p>

        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="signup-field">
            <label htmlFor="username">Username</label>
            <input className="account-control" type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>

          <div className="signup-field">
            <label htmlFor="email">Email</label>
            <input className="account-control" type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="signup-field">
            <label htmlFor="password">Password</label>
            <input className="account-control" type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <div className="signup-field">
            <label htmlFor="sponsorMessage">Sponsor/Message</label>
            <textarea className="account-control" id="sponsorMessage" value={sponsorMessage} onChange={(e) => setSponsorMessage(e.target.value)} required />
          </div>

          <div className="signup-field">
            <label htmlFor="desiredAccessLevel">Desired Access Level</label>
            <select className="account-control" id="desiredAccessLevel" value={desiredAccessLevel} onChange={(e) => setDesiredAccessLevel(e.target.value)}>
              <option value="regular">Regular User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button className="signup-primary-btn account-button" type="submit">Submit Request</button>
          {message && <p className="signup-message">{message}</p>}
        </form>

        <p className="signup-login-row">
          Already have an account?{' '}
          <Link className="signup-login-link account-link" to="/login">
            Login
          </Link>
        </p>
      </div>
    </InfoPage>
  );
}

export default Signup;
