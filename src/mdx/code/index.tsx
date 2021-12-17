import React from 'react';
import { Head } from 'react-static';
import SyntaxHighlighter from 'react-syntax-highlighter';
import './code.scss';

export const Code: React.FC<{children:string, className?: string}> =
    ({children, className}) => (<>
        <Head><link rel="stylesheet" href="/css/monokai.css" /></Head>
        <SyntaxHighlighter 
            useInlineStyles={false}
            language={className ? className.replace(/language-/, '') : ''}>
                {children.trim()}
        </SyntaxHighlighter>
   </>);