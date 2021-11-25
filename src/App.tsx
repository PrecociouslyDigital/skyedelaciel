import React from 'react';
import { Root, Routes, Head } from 'react-static';
import { Router } from '@reach/router';
import { Nav } from 'components/nav';
import { SchemeProvider } from 'components/colors';
import { MarkdownProvider } from './mdx';
import './app.scss';


function App() {
    return (
        <Root>
            <Head>
                <link rel="stylesheet" href="/fonts/fira.css"/>
            </Head>
            <SchemeProvider>
                <MarkdownProvider>
                    <Nav />
                    <div className="content">
                        <React.Suspense fallback={<em>Loading...</em>}>
                            <Router>
                                <Routes path="*" />
                            </Router>
                        </React.Suspense>
                    </div>
                </MarkdownProvider>
            </SchemeProvider>
        </Root>
    )
}

export default App
