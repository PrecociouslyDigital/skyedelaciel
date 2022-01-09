import React from 'react'
import { Link } from '@reach/router';
import './nav.scss';
import { useRouteData } from 'react-static';
import Markdown from 'markdown-to-jsx';

export const Nav = () => (
    <nav>
        <NavItem to="/" name="Home" />
        <NavItem to="/games" name="Games">
            <Link to="/games/test">Test</Link>
        </NavItem>
        <NavItem to="/music" name="Music">
            <Link to="/games/test">Test</Link>
        </NavItem>
        <NavItem to="/writing" name="Writing">
            <Link to="/games/test">Test</Link>
        </NavItem>
        <NavItem to="/writing" name="Code">
            <Link to="/games/test">Test</Link>
        </NavItem>
        <NavItem to="/about" name="About" />
    </nav>
);

const NavItem: React.FC<{
        name: string;
        to: string;
}> = ({name, to, children}) => {
        const fencepostedChildren = React.Children.toArray(children);
        if(fencepostedChildren.length === 0){
                return (
                    <>
                        <Link to={to}>{name}</Link>
                        <br/>
                    </>
                );
        }
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

export const Previews: React.FC = () => {
    const {location, subPaths} = useRouteData();
    if(subPaths == null){
        return null;
    }
    return (
      <>
        {Object.entries<{
          title: string;
          abstract?: string;
        }>(subPaths).map(([key, value]) => (
          <p>
            <Link to={`${location}/${key}`}>
                <h3>{value.title}</h3>
            </Link>
            {value.abstract != null && <Markdown>{value.abstract}</Markdown>}
          </p>
        ))}
      </>
    );
} 