import SyntaxHighlighter from 'react-syntax-highlighter';
import { monokaiSublime } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import React from 'react';
import './code.css';
import { Head } from 'react-static';

export const Code: React.FC<{className: string}> =
    ({children, className}) => (<>
        <Head><link rel="stylesheet" href={`css/monokai.min.css`} /></Head>
        <SyntaxHighlighter 
            style={monokaiSublime}
            className='monokai-background'
            useInlineStyles={false}
            customStyle={{
                borderLeft:'none',
                background: 'rgb(35, 36, 31)',
            }}
            language={className.replace(/language-/, '')}>
                {children}
        </SyntaxHighlighter>
   </>)