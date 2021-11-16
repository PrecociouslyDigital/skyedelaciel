import React from 'react'
import { Link } from '@reach/router';

export const Nav = () => (
    <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
        <Link to="/blog">Blog</Link>
    </nav>
)
