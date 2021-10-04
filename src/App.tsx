import React from 'react';
import { Root, Routes } from 'react-static';
import { Router } from '@reach/router';
import { Nav } from 'components/nav';
import "milligram";
import 'app.css';


function App() {
    return (
        <Root>
            <Nav />
            <div className="content">
                <React.Suspense fallback={<em>Loading...</em>}>
                    <Router>
                        <Routes path="*" />
                    </Router>
                </React.Suspense>
            </div>
        </Root>
    )
}

export default App
