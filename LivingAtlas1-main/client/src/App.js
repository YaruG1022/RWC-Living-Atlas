import './App.css';
import Header from './Header';
import Main from './Main';
import Home from './Home';
import About from './About';
import Contact from './Contact';
import Login from './Login';
import Profile from './Profile';
import Navbar from './Navbar';
import Signup from './Signup';
import Administration from './Administration';
import Reset from './Reset';
import SwitchAccount from './SwitchAccount';
import ChangelogHistory from './ChangelogHistory';
import UserManual from './UserManual';
import { BrowserRouter as Router, Route, Switch, Redirect } from 'react-router-dom';
import { useEffect, useState } from 'react';

const AUTH_STORAGE_VERSION = '2';

function normalizeAuthFlag(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 't', 'yes', 'y', 'admin'].includes(normalized);
  }
  return false;
}

function safeParseBooleanFromStorage(key) {
  const raw = localStorage.getItem(key);

  // Guard against null, "undefined", "null", or empty string
  if (!raw || raw === 'undefined' || raw === 'null') {
    return false;
  }

  try {
    return normalizeAuthFlag(JSON.parse(raw));
  } catch (e) {
    const fallback = normalizeAuthFlag(raw);
    console.warn(`Failed to parse boolean from localStorage for key "${key}". Using normalized fallback:`, {
      raw,
      fallback,
      error: e
    });
    return fallback;
  }
}

function App() {
  // Restore before protected routes render, and before the persistence effect runs.
  const [savedAuth] = useState(() => {
    const isCurrentVersion = localStorage.getItem('authStorageVersion') === AUTH_STORAGE_VERSION;
    const isLoggedIn = isCurrentVersion && safeParseBooleanFromStorage('isLoggedIn');
    return {
      isLoggedIn,
      email: isLoggedIn ? localStorage.getItem('email') || '' : '',
      username: isLoggedIn ? localStorage.getItem('username') || '' : '',
      isAdmin: isLoggedIn && safeParseBooleanFromStorage('isAdmin'),
    };
  });
  const [email, setEmail] = useState(savedAuth.email);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(savedAuth.isLoggedIn);
  const [username, setUsername] = useState(savedAuth.username);
  const [isAdmin, setIsAdmin] = useState(savedAuth.isAdmin);

  // Update localStorage when login state changes
  useEffect(() => {
    localStorage.setItem('authStorageVersion', AUTH_STORAGE_VERSION);
    localStorage.setItem('isLoggedIn', JSON.stringify(isLoggedIn));
    localStorage.setItem('email', email || '');
    localStorage.setItem('username', username || '');
    localStorage.setItem('isAdmin', JSON.stringify(isAdmin));
  }, [isLoggedIn, email, username, isAdmin]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setEmail('');
    setPassword('');
    setUsername("You're logged out.");
    setIsAdmin(false);
    setMessage('Successfully logged out.');
    localStorage.setItem('isLoggedIn', JSON.stringify(false));
    localStorage.setItem('email', '');
    localStorage.setItem('username', '');
    localStorage.setItem('isAdmin', JSON.stringify(false));
    localStorage.removeItem('profileImage');
  };

  return (
    <Router>
      <Navbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} username={username} email={email} onLogout={handleLogout} />
      <Switch>
        <Route exact path="/">
          <Home isLoggedIn={isLoggedIn} username={username} email={email} isAdmin={isAdmin} />
        </Route>
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
        <Route path="/login">
          <Login
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            message={message}
            setMessage={setMessage}
            isLoggedIn={isLoggedIn}
            setIsLoggedIn={setIsLoggedIn}
            username={username}
            setUsername={setUsername}
            isAdmin={isAdmin}
            setIsAdmin={setIsAdmin}
          />
        </Route>
        <Route path="/profile">
          {isLoggedIn ? (
            <Profile
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              message={message}
              setMessage={setMessage}
              isLoggedIn={isLoggedIn}
              setIsLoggedIn={setIsLoggedIn}
              username={username}
              setUsername={setUsername}
              isAdmin={isAdmin}
            />
          ) : (
            <Redirect to="/login" />
          )}
        </Route>
        <Route path="/signup" component={Signup} />
        <Route path="/administration">
          {isLoggedIn && isAdmin ? <Administration currentEmail={email} onCurrentRoleChange={setIsAdmin} /> : <Redirect to="/login" />}
        </Route>
        <Route path="/switch-account">
          {isLoggedIn ? (
            <SwitchAccount
              email={email}
              setEmail={setEmail}
              setPassword={setPassword}
              setMessage={setMessage}
              setIsLoggedIn={setIsLoggedIn}
              setUsername={setUsername}
              setIsAdmin={setIsAdmin}
            />
          ) : (
            <Redirect to="/login" />
          )}
        </Route>
        <Route path="/update-history" component={ChangelogHistory} />
        <Route path="/user-manual" component={UserManual} />
        <Route path="/reset-password" component={Reset} />
        <Route path="*">
          <h1>404 - Page Not Found</h1>
        </Route>
      </Switch>
    </Router>
  );
}

export default App;
