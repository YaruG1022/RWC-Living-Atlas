import React, { useState } from 'react';
import './AccountPage.css';
import './Register.css';
import api from './api.js';
function Register({ closeRegister }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');

    const handleRegister = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setMessage('Passwords do not match.');
            return;
        }

        try {


            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('password', password);
            formData.append('role', false)


            // Post the form data
            const response = await api.post('/uploadAccount', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data' // Optional: Axios sets this automatically for FormData
                }
            });


            if (response.data.success) {
                setMessage('Account created successfully.');
                // You might want to close the form or redirect the user
            } else {
                setMessage(response.data.message);

            }
        } catch (error) {
            setMessage('An error occurred. Please try again later.');
            console.error('There was an error!', error);
            alert(error);
        }
    };
    const handleNameChange = (e) => {
        setName(e.target.value);
    };

    return (
        <div className="register-backdrop" onClick={closeRegister}>
            <div className="register-modal account-dialog" role="dialog" aria-modal="true" aria-labelledby="register-title" onClick={(e) => e.stopPropagation()}>
                <h2 id="register-title" className="register-title">Register</h2>
                <form onSubmit={handleRegister}>
                    <div className="register-form-group">
                        <label htmlFor="register-name">Name:</label>
                        <input className="account-control" type="text" id="register-name" name="username" value={name} onChange={handleNameChange} required />
                    </div>
                    <div className="register-form-group">
                        <label htmlFor="register-email">Email:</label>
                        <input className="account-control" type="email" id="register-email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="register-form-group">
                        <label htmlFor="register-password">Password:</label>
                        <input className="account-control" type="password" id="register-password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <div className="register-form-group">
                        <label htmlFor="register-confirm-password">Confirm Password:</label>
                        <input
                            className="account-control"
                            type="password"
                            id="register-confirm-password"
                            name="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="register-form-actions">
                        <button type="submit" className="account-button">Register</button>
                        <button type="button" onClick={closeRegister} className="account-button account-button--secondary">Cancel</button>
                    </div>

                    {message && <p className="register-message">{message}</p>}
                </form>
            </div >
        </div >
    );
}

export default Register;
