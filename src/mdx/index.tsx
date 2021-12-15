import { Code } from './code';
import { Image } from './img'; 
import { Blockquote } from './blockquote';
import { MDXProvider } from '@mdx-js/react'; 
import React from 'react';
import { useRouteData } from 'react-static';
import jsxToString from 'jsx-to-string';
import { Header } from './headers';

export const MarkdownProvider: React.FC<{}> = ({children}) => (
    <MDXProvider components={{
        code: Code,
        img: Image,
        blockquote: Blockquote,
        wrapper: wrapper,
        h1: Header('h1'),

    }}>
        {children}
    </MDXProvider>
);
interface HeaderData {
    title: string;
    slug: string;
    children: HeaderData[];
}

const createHeaderDataFromElement= (ele: HTMLElement) : HeaderData => ({
    title: ele.innerText,
    slug: ele.innerText.replace(' ', '-').replace(/[^a-zA-Z0-9-_]/g, ''),
    children: [],
});

function createTOCFromEleList(){
    const h1s: HeaderData[]  = [];
    return [function(ele: HTMLElement){
        if(ele.tagName.charAt(0) !== 'h'){
            throw new Error(`This isn't a header!`);
        }
        const level = parseInt(ele.tagName.charAt(1));
        if(level > 5){
            throw new Error(`Your h${level} is too big!`);
        }
        let relevantHeaders = h1s;
        for(let i = 0; i < level; i++){
            relevantHeaders = relevantHeaders[relevantHeaders.length - 1].children
        }
        relevantHeaders.push(createHeaderDataFromElement(ele))
    }, h1s]
}

const wrapper : React.FC<{}> = ({components, children}: {components: React.ReactChild, children: React.ReactNode} ) => {
    let childrenArray = React.Children.toArray(children);
    console.log(childrenArray.map(jsxToString));
    const routeData = useRouteData();
    return <div>
        
        {children}
    </div>
}