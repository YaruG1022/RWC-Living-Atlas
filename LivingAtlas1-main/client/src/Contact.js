import React, { useState } from 'react';
import './Contact.css';
import InfoPage from './InfoPage';
import api from './api.js';

function Contact() {
    const [form, setForm] = useState({ name: '', email: '', message: '' });
    const [status, setStatus] = useState(null); // 'success' | 'error' | null
    const [loading, setLoading] = useState(false);

    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setStatus(null);
        try {
            await api.post('/submit-feedback', form);
            setStatus('success');
            setForm({ name: '', email: '', message: '' });
        } catch (err) {
            setStatus('error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <InfoPage title="Contact Us" className="contact">
            <section aria-labelledby="contact-address-title">
                <h2 id="contact-address-title" className="info-page__section-title">Address</h2>
                <address className="contact-address">
                    <p>Rivers, Watersheds, Communities (RWC)</p>
                    <p>Paccar Room 360</p>
                    <p>Washington State University</p>
                    <p>Pullman, WA 99164-5825</p>
                </address>
            </section>
            <section aria-labelledby="contact-email-title">
                <h2 id="contact-email-title" className="info-page__section-title">Email</h2>
                <ul className="contact-emails">
                    <li><a className="info-page__link" href="mailto:j.boll@wsu.edu">j.boll@wsu.edu</a></li>
                    <li><a className="info-page__link" href="mailto:wsu.cereoatlas25@gmail.com">wsu.cereoatlas25@gmail.com</a></li>
                </ul>
            </section>

            <h2 className="info-page__section-title">Send Us Feedback</h2>
            <form className="feedback-form" onSubmit={handleSubmit}>
                <div className="feedback-field">
                    <label htmlFor="feedback-name">Name</label>
                    <input
                        id="feedback-name"
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Your name"
                        required
                    />
                </div>
                <div className="feedback-field">
                    <label htmlFor="feedback-email">Email</label>
                    <input
                        id="feedback-email"
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="Your email"
                        required
                    />
                </div>
                <div className="feedback-field">
                    <label htmlFor="feedback-message">Message</label>
                    <textarea
                        id="feedback-message"
                        name="message"
                        value={form.message}
                        onChange={handleChange}
                        placeholder="Your feedback..."
                        rows={5}
                        required
                    />
                </div>
                <button type="submit" className="feedback-submit" disabled={loading}>
                    {loading ? 'Sending...' : 'Submit Feedback'}
                </button>
                {status === 'success' && (
                    <p className="feedback-msg feedback-success" role="status">Feedback sent successfully!</p>
                )}
                {status === 'error' && (
                    <p className="feedback-msg feedback-error" role="alert">Failed to send feedback. Please try again.</p>
                )}
            </form>
        </InfoPage>
    );
}

export default Contact;
