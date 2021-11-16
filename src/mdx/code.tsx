import SyntaxHighlighter from 'react-syntax-highlighter';
import { monokaiSublime } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import React from 'react';
import './code.css';

export const Code: React.FC<{className: string}> =
    ({children, className}) => (
        <SyntaxHighlighter 
            style={monokaiSublime}
            code={children}
            language={className.replace(/language-/, '')}>
        </SyntaxHighlighter>
   )