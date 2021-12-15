import React from 'react';
import jsxToString from 'jsx-to-string';

type Headers = 'h1' | 'h2' | 'h3' | 'h4' | 'h5';

const renderChild = (child: {
    props: {
        children: any[]
    }
} | any) => {
    if(child.props != null && child.props.children != null){
        if(Array.isArray(child.props.children)){
            return child.props.children.map(renderChild).join('-');
        }else{
            return child.props.children.toString();
        }
    }
    return child.toString();
}
export const Header:(headerType: Headers) => React.FC<{}> =
    (headerType) => ({children}) => {
        const id = React.Children.map(
            children, child => renderChild(child)
            ).join('')
            .replace(' ', '-')
            .replace(/[^a-zA-Z0-9-_]/g, '')
        return React.createElement(headerType, {
                id,
                key: id,
            }, children);
    } 