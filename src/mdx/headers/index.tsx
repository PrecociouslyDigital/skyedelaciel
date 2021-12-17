import React from 'react';
import { renderChildren } from '../';

type Headers = 'h1' | 'h2' | 'h3' | 'h4' | 'h5';

export const slugfy = (children: string) => children
            .replace(/ /g, '-')
            .replace(/[^a-zA-Z0-9-_]/g, '')
export const Header:(headerType: Headers) => React.FC<{index?: string}> =
    (headerType) => ({index, children}) => {
        const id = slugfy(renderChildren(children));
        const childrenArray = React.Children.toArray(children);
        if(index != null){
            childrenArray.splice(0,0, index);
        }
        return React.createElement(headerType, {
                id,
                key: id,
            }, children);
    } 