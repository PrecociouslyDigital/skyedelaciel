import React from 'react';
import { Head } from 'react-static';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { monokaiSublime } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import './code.scss';

export const Code: React.FC<{className?: string}> =
    ({children, className}) => (<>
        <Head><link rel="stylesheet" href={`/css/monokai.css`} /></Head>
        <SyntaxHighlighter 
            style={monokaiSublime}
            useInlineStyles={false}
            language={className ? className.replace(/language-/, '') : ''}>
                {children}
        </SyntaxHighlighter>
   </>);