import React from 'react';
import { Head } from 'react-static';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { monokaiSublime } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Pre } from '../pre';
import './code.scss';

export const Code: React.FC<{className?: string}> =
    ({children, className}) => (<>
        <Head><link rel="stylesheet" href={`css/monokai.min.css`} /></Head>
        {className ? <SyntaxHighlighter 
            style={monokaiSublime}
            className='monokai-background'
            useInlineStyles={false}
            language={className.replace(/language-/, '')}>
                {children}
        </SyntaxHighlighter> : <Pre>{children}</Pre>}
   </>)