import React from 'react';
import InfoPage from './InfoPage';

function About() {
    return (
        <InfoPage title="About Us" className="about-page" data-testid="test-about">
            <p className="info-page__text">Living Atlas is a web application aimed at solving the problem of scattered and
                inaccessible environmental data. Our goal is to provide a central location for collecting, sharing,
                and accessing environmental data, making it available to a wide range of stakeholders including
                tribal communities, academic institutions, and government agencies.</p>
        </InfoPage>
    );
}

export default About;
