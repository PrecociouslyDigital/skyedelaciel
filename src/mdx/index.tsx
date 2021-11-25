import { Code } from './code';
import { Pre } from './pre';
import { MDXProvider } from '@mdx-js/react'; 
import React from 'react';

export const MarkdownProvider: React.FC<{}> = ({children}) => (
    <MDXProvider components={{
        code: Code,
        pre: Pre,
    }}>
        {children}
    </MDXProvider>
);