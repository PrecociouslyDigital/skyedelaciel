import React from 'react';
import './code.css';

export const Code: React.FC =
    ({children}) => (<pre>
        {children}
   </pre>)