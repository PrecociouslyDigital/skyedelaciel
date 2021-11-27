import React from 'react'
import { Link } from '@reach/router';
import './nav.scss';

export const Nav = () => (
    <nav>
        <NavItem to="/" name="Home">
            <Link to="/test">test</Link>
            <Link to="/test">test</Link>
            <Link to="/test">test</Link>
            <Link to="/test">test</Link>
            <Link to="/test">test</Link>
            <Link to="/test">test</Link>
        </NavItem>
        <NavItem to="/about" name="About"/>
    </nav>
)

const NavItem: React.FC<{
    name: string;
    to: string;
}> = ({name, to, children}) => {
    const fencepostedChildren = React.Children.toArray(children);
    for(let i = fencepostedChildren.length - 1; i > 0; i--) {
        fencepostedChildren.splice(i, 0, <hr/>)
    }
    return (<>
        <Link to={to}>{name}</Link>
        <input name={`dropdown${to}`} id={`dropdown${to}`} type="checkbox"/>
        <label htmlFor={`dropdown${to}`}></label>
        <div>{fencepostedChildren}</div>
    </>);
}