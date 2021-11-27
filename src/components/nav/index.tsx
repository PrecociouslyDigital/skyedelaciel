import React from 'react'
import { Link } from '@reach/router';
import './nav.scss';

export const Nav = () => (
    <nav>
        <NavItem to="/" name="Home">
            <Link to="/test">test</Link>
        </NavItem>
        <NavItem to="/about" name="About"/>
    </nav>
)

const NavItem: React.FC<{
    name: string;
    to: string;
}> = ({name, to, children}) => (<>
    <Link to={to}>{name}</Link>
    <input name={`dropdown${to}`} id={`dropdown${to}`} type="checkbox"/>
    <label htmlFor={`dropdown${to}`}></label>
    <div>{children}</div>
</>)