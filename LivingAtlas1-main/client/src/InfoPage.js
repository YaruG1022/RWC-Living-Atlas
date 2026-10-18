import React from 'react';
import './InfoPage.css';

export default function InfoPage({ title, className = '', children, ...props }) {
    return (
        <main className={`info-page ${className}`.trim()} {...props}>
            <h1 className="info-page__title">{title}</h1>
            {children}
        </main>
    );
}
