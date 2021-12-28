import React from 'react';
import { Root, Routes, Head } from 'react-static';
import { Router } from '@reach/router';
import { Nav } from 'components/nav';
import { MarkdownProvider } from './mdx';
import './app.scss';
import './components/colors/colors.scss';
import { Footer } from 'components/footer';

function Ugh({default} : {default:boolean}){
    return <h1>NO PATH FOUND UWU</h1>
}
function App() {
    return (
        <Root>
            <Head>
                <link rel="stylesheet" href="/css/fira.css"/>
            </Head>
                <MarkdownProvider>
                    <React.Suspense fallback={<em>Loading...</em>}>
                        <Nav />
                        <div className="content">
                            <Router>
                                <Routes path="*" />
                            </Router>
                        </div>
                    </React.Suspense>
                </MarkdownProvider>
        </Root>
    )
}

export default App
