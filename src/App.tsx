import React from 'react';
import { Root, Routes, Head } from 'react-static';
import { Router } from '@reach/router';
import { Nav } from 'components/nav';
import { MarkdownProvider } from './mdx';
import './app.scss';
import './components/colors/colors.scss';

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
                    <Nav />
                    <div className="content">
                        <React.Suspense fallback={<em>Loading...</em>}>
                            <Router>
                                <Routes path="*" />
                                <Ugh default/>
                            </Router>
                        </React.Suspense>
                    </div>
                </MarkdownProvider>
        </Root>
    )
}

export default App
