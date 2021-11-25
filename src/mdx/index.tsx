import { Code } from './code';
import { Image } from './img'; 
import { MDXProvider } from '@mdx-js/react'; 
import React from 'react';

export const MarkdownProvider: React.FC<{}> = ({children}) => (
    <MDXProvider components={{
        code: Code,
        img: Image,
    }}>
        {children}
    </MDXProvider>
);


